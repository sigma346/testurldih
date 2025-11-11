async function register() {
    const username = document.getElementById("username").value
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value

    const { data, error } = await db.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                username: username
            }
        }
    });

    if (error) {
        alert(error.message)
    } else {
        alert("Account created — check your email to verify.")

        await db.from("users").insert({
            username: username,
            email: email
        });
    }
}


async function login() {
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value

    const { data, error } = await db.auth.signInWithPassword({ email, password })
    if (error) {
        alert(error.message)
    } else {
        alert("Logged in. You’re him.")
    }
}