<script>
  import { goto } from '$app/navigation';

    // @ts-ignore
    import { handleSignup } from '$lib/supabase';

    let email = '';
    let password = '';
    let displayName = '';
  
    const signup = async () => {
      try {
        await handleSignup(email, password, displayName);
        alert('Signup successful! Please check your email for confirmation.');
      } catch (err) {
        // @ts-ignore
        alert(err.message);
      }
    };
  </script>
  
  <style>
    main {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #f5f5f5;
      font-family: Arial, sans-serif;
    }
  
    form {
      background: white;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      padding: 20px;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
  
    input, button {
      margin-top: 10px;
      width: 90%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
  
    button {
      background: #4caf50;
      color: white;
      font-weight: bold;
      cursor: pointer;
      border: none;
    }
  
    button:hover {
      background: #45a049;
    }
  
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
  </style>
  
  <main>
    <h1>Create Your Account</h1>
    <form on:submit|preventDefault={signup}>
      <label>
        <input type="text" bind:value={displayName} placeholder="Enter your name" required />
      </label>
      <label>
        <input type="email" bind:value={email} placeholder="Enter your email" required />
      </label>
      <label>
        <input type="password" bind:value={password} placeholder="Enter your password" required />
      </label>
      <button type="submit">Sign Up</button>
      <button on:click={()=>goto("/signin")} style="background: blue;">Got an account? Sign in here.</button>
    </form>
  </main>
