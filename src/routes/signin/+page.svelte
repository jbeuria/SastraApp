<script>
import { handleLogin, handleGoogleSignIn } from '$lib/supabase';

import { goto } from '$app/navigation';
let email = 'sastrauser108@gmail.com';
let password = 'gopal#108';

const login = async () => {
  try {
    await handleLogin(email, password);
    // alert('Login successful!');
    await goto('/');
  } catch (err) {
    // @ts-ignore
    alert(err.message);
  }
};

// const googleLogin = async () => {
//   try {
//     await handleGoogleSignIn();
//     alert('Google login successful!');
//   } catch (err) {
//     // @ts-ignore
//     alert(err.message);
//   }
// };
</script>


<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: linear-gradient(to right, #ece9e6, #ffffff);
    font-family: 'Arial', sans-serif;
  }

  form {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1);
    padding: 30px;
    width: 100%;
    max-width: 400px;
    text-align: center;
    margin-bottom: 30px;
  }

  input {
    margin: 10px 0;
    width: calc(100% - 20px);
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
  }

  button {
    background: #4caf50;
    color: #fff;
    font-weight: bold;
    cursor: pointer;
    border: none;
    border-radius: 8px;
    padding: 12px;
    width: 100%;
    font-size: 16px;
    margin-top: 10px;
  }

  button:hover {
    background: #45a049;
  }

  h1 {
    color: #333;
    margin-bottom: 25px;
    font-size: 28px;
  }

  .social-login {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    width: 100%;
  }

  .google-button,
  .signup-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #313132;
    color: #fff;
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    flex: 1; /* Ensures both buttons have equal width */
    text-align: center;
    max-width: 200px;
    height: 50px; /* Consistent height for both buttons */
    box-sizing: border-box; /* Includes padding in width/height calculation */
  }

  .google-button:hover,
  .signup-button:hover {
    background: #693fe8;
  }

  .google-icon {
    width: 20px;
    height: 20px;
    margin-right: 10px;
  }

  .signup-button {
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  :global(html), :global(body), :global(#app) {
        margin: 0;
        padding: 0;
        width: 100vw;
        height: 100vh;
        overflow-x: hidden;
    }

</style>

<main style="padding: 20px;">
  <h1>Welcome back to ŚĀSTRA</h1>
  <form on:submit|preventDefault={login} >
    <label>
      <input type="email" bind:value={email} placeholder="Enter your email" required />
    </label>
    <label>
      <input type="password" bind:value={password} placeholder="Enter your password" required />
    </label>
    <button type="submit">Sign In</button>
  </form>

  <div class="social-login">
    <!-- <button class="google-button" on:click={googleLogin}>
      <img class="google-icon" src="/GoogleG.png" alt="Google Logo" />
      Google Login
    </button> -->
    <a class="signup-button" href='/signup'>New User?<br>Click to Sign Up</a>
  </div>
</main>
