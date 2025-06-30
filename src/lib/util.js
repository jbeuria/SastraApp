// @ts-nocheck
import JSZip from "jszip";
import {settings,writeSettings } from '$lib/store.svelte';
import { resolve, resolveResource,documentDir } from '@tauri-apps/api/path';
import { mkdir, readTextFile, exists,readDir,BaseDirectory,readFile } from '@tauri-apps/plugin-fs';
import Database from '@tauri-apps/plugin-sql';
import {fetchOnlineBooksList,fetchOnlineToc,
  getAuthInfo,fetchOnlineBookContent} from '$lib/supabase'


// import {loadDatabase,queryDatabase} from '$lib/db'

export function isEmptyObject(obj) {
    try{
        // // console.log('obj',obj)
        return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
    }
    catch(e)
    {   
        // console.log(e)
        return false;
    }
}

export async function ensureFolderExists(folderPath) {
  try {
    await readDir(folderPath, { baseDir: BaseDirectory.Document });
    // console.log(`Folder already exists: ${folderPath}`);
  } 
  catch (error) {
    // console.log(`Folder not found. Creating: ${folderPath}`);
    await mkdir(folderPath, { recursive: true, baseDir: BaseDirectory.Document });

  }
}

export async function writeTxtFile(data,folderPath, fileName) {
 
  try
  {
    await ensureFolderExists(folderPath)
    const fullPath = `${folderPath}/${fileName}`;
    await writeFile(fullPath, data, { baseDir: BaseDirectory.Document });
  }
  catch (error) {
    // console.log(error)
  }

}

const getFileExtension = filename => filename.includes('.') ? filename.split('.').pop() : '';


export async function listBooks()
{   
    let auth=await getAuthInfo();
    let entries=[]

    let status=await exists('SastraApp/bookslist.json', { baseDir: BaseDirectory.Document});
    let fileContent = null 
    if(status) fileContent = await readTextFile('SastraApp/bookslist.json', { baseDir: BaseDirectory.Document });
    let entries_temp= JSON.parse(fileContent);
    entries=entries_temp.map(b => {b.short_name= `${b.short_name} (L)`; return b})

    if(auth.user && auth.role==='permitted')
    {
      let books= await fetchOnlineBooksList();
      let temp=books.map(b => {b.short_name= `${b.short_name} (O)`; b.file=""; b.toc=`toc_${b.code}.json.zip`;return b})
      // // console.log(temp)
      if(temp.length>0) entries=[...entries,...temp]

      const resourcePath = await resolveResource('../resources/bookslist.json');
      let entries2_temp=JSON.parse(await readTextFile(resourcePath), { baseDir: BaseDirectory.Resource });
      let entries2=entries2_temp.map(b => {b.short_name= `${b.short_name} (I)`; return b})
      entries=[...entries,...entries2]
      
    }
    // console.log(entries)
    settings.booksAvailable=entries
    await writeSettings();
}

export async function loadToc()
{
  try 
  {
    await listBooks();
    let auth=await getAuthInfo();

    let folderPath='SastraApp/db';
    let baseDir=BaseDirectory.Document;
  
    let allToc=[]

    for (const book of settings.booksAvailable){

      let tocData=[]
      const fileName = book.toc;
      // console.log(settings.booksAvailable)
      const fileType= getFileExtension(fileName)
      let tocPath = `${folderPath}/${fileName}`
      if(auth.user && auth.role==='permitted' && book.short_name.endsWith(" (O)"))
      {
        tocData=await fetchOnlineToc(book.toc)
      }
      else
      {
        if(auth.user && auth.role==='permitted' && book.short_name.endsWith(" (I)"))
        { 
            folderPath='../resources/db';
            baseDir=null //BaseDirectory.Resource
            tocPath = `${folderPath}/${fileName}`
            tocPath= await resolveResource(tocPath);
        }
        // console.log(book.short_name,tocPath,baseDir)
        if(fileType=='zip' || 'gz') tocData=await readJsonFromZip(tocPath,baseDir)
        else if(fileType=='json')
        {
              const fileContent = await readTextFile(tocPath, { baseDir: baseDir });
              tocData = JSON.parse(fileContent);
        }
        else if(fileType=='db') tocData = await readDB(book,tocPath,baseDir)
        else tocData = [];
      }
      allToc=[...allToc,tocData]
    }
    return allToc;
  } 
  catch (err) 
  {
      console.error("Error reading the ZIP file:", err);
      return {};
  }  
}

export async function fetchContent(url,isCollection)
{
  let auth=await getAuthInfo();
  let book=settings.book
  // console.log('current book',book)

  let data=[]
  let fileName = book.file;
  let fileType= getFileExtension(fileName)
  let bookPath="";
  if(auth.user && auth.role==='permitted')
  {
    if(book.short_name.endsWith(" (O)")) 
    return await fetchOnlineBookContent(book.code,url,isCollection);

    if(book.short_name.endsWith(" (I)")) 
      bookPath = await resolveResource(`../resources/db/${fileName}`);
  }
  if(book.short_name.endsWith(" (L)"))
    bookPath =  `SastraApp/db/${fileName}`
  
  if(fileType==='db')
  {
    const documentDirPath = await documentDir()
    bookPath=`${documentDirPath}/${bookPath}`
    //// console.log(bookPath,url)

    const db = await Database.load(`sqlite:${bookPath}`);

    let sql=`SELECT * from ${book.code} where verse_url = $1`;
    let db_params=url
    if(isCollection){
      sql=`SELECT * from ${book.code} where verse_url like $1`;
      db_params=`${url}/%`;
    }
    const result = await db.select(sql,[db_params]);
    // // console.log(result)
    return result
  }
  else if (fileType==='json')
  {
    const fileContent = await readTextFile(bookPath, { baseDir: BaseDirectory.Document });
    data = JSON.parse(fileContent);
  }
  else if (fileType==='zip') data=await readJsonFromZip(bookPath,BaseDirectory.Document)

  if(isCollection)
  {  
    let regex = new RegExp(`^${url}/`);
    let filtered_data= data.filter((row) => regex.test(row.verse_url));
    return filtered_data;
  }
  else
  {
    let filtered_data= data.filter((row) => row.verse_url==url);
    return filtered_data;
  }
}

export async function readJsonFromZip(zipFilePath,baseDir=BaseDirectory.Document) {
  try {
    // console.log(zipFilePath)
    // Read the binary contents of the zip file
    const zipContent = await readFile(zipFilePath, { baseDir: baseDir });

    // Load the ZIP file into JSZip
    const zip = await JSZip.loadAsync(zipContent);

    // Assuming the ZIP contains a single JSON file or a specific one named 'data.json'
    const fileName = Object.keys(zip.files).find(name => name.endsWith(".json"));

    if (!fileName) {
      throw new Error("No JSON file found in the ZIP archive");
    }
    // Extract and parse the JSON file
    const jsonContent = await zip.file(fileName).async("string");
    const jsonData = JSON.parse(jsonContent);

    // // console.log("Extracted JSON Data:", jsonData);
    return jsonData;
  } catch (error) {
    console.error("Error reading JSON from ZIP file:", error);
    return {};
  }
}

export async function readDB(book,bookPath,baseDir)
{
  try{
    const dbPath = `${baseDir}/${bookPath}`
    const db = await Database.load(`sqlite:${dbPath}`);
    const result = await db.execute(
      `SELECT * from ${book.code}`,
      []
    );
    return result.rows;
    // const jsonResponse = JSON.stringify(result.rows);
    // return jsonResponse;
  }
  catch(e)
  {
    console.error("Error reading DB file:", e);
    throw error;
  }
}


export async function searchContent(searchStr)
{
    
}