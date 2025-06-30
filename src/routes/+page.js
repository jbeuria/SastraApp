// @ts-nocheck
import { goto } from '$app/navigation';
import {getAuthInfo} from '$lib/supabase'

export async function load({ fetch }) {
    let auth=await getAuthInfo();
    console.log("Hare Krishna!",auth)
    if(!auth.user) goto("/signin");
    return auth;
}