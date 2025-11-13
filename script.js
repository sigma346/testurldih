const db = supabase.createClient(
    "https://zdtpcfxzncehhnvmglsj.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHBjZnh6bmNlaGhudm1nbHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzcwMDYsImV4cCI6MjA3ODQxMzAwNn0.vlwKNgq0Gqyg7e747O7s3KCVw2J9bZQfS5zzW78X6RY"
);

// ---------- Helpers ----------
function qs(id) { return document.getElementById(id); }
function showAlert(msg) { alert(msg); } // replace with custom UI later

// ---------- Register ----------

async function register() {
  
  console.log("🔥 register() function called");
  const username = qs("username").value.trim();
  const email = qs("email").value.trim();
  const password = qs("password").value;
  const color = qs("color")?.value || "#4fb446";
  console.log("Registering user:", { username, email, password, color });


  if (!username || !email || !password) {
    alert("Fill username, email, and password.");
    return;
  }

  console.log("👀 about to check username uniqueness");
  console.log("DB object is:", db);
  // Step 1: username check
  const { data: existingUsers, error: userCheckErr } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .limit(1);

  console.log("username check:", existingUsers, userCheckErr);

  if (userCheckErr) {
    alert("Error checking username.");
    return;
  }
  if (existingUsers?.length > 0) {
    alert("Username taken.");
    return;
  }

  // Step 2: Auth signup
  const { data: signData, error: signErr } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { preferred_username: username },
      emailRedirectTo: `${window.location.origin}/verified.html`
    }
  });


  console.log("signData:", signData, "signErr:", signErr);

  // Step 3: Insert into users table
  if (!signErr) {
    const userId = signData?.user?.id;

    if (userId) {
      // Only insert if we got the user immediately (rare case)
      const { error: insertErr } = await db.from("users").insert([
        { id: userId, username, email, color },
      ]);

      if (insertErr) {
        console.error("profile insert error:", insertErr);
      }
      alert("Account created successfully!");
    } else {
      // Most users will hit this case
      alert("Account created — please check your email to verify before logging in.");
    }
  }

    

}


// ---------- Login ----------
async function login() {
  const email = qs("email").value.trim();
  const password = qs("password").value;
  if (!email || !password) {
    showAlert("Enter email and password.");
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("login error", error);
    showAlert(error.message || "Login failed.");
    return;
  }

  // After login, fetch user profile and apply username/color
  await applyProfileToUI();
  showAlert("Logged in.");
}

// ---------- Logout ----------
async function logout() {
  await db.auth.signOut();
  currentUser = null; // clear current user
  // clear ui
  qs("chat-username").value = "";
  // any UI changes you want
  showAlert("Logged out");
  loadNavbarAuth(); // update navbar buttons
  
}

// ---------- Apply profile to UI ----------
async function applyProfileToUI() {
  const { data: userData } = await db.auth.getUser();
  const user = userData?.user;
  if (!user) return;

  // fetch profile row
  const { data: profile, error } = await db
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.warn("couldn't fetch profile:", error);
    return;
  }

  // populate chat username and color
  if (profile) {
    qs("chat-username").value = profile.username;
    // store user color somewhere; we will use it when sending messages
    window.currentUser = { id: profile.id, username: profile.username, color: profile.color };
  }
}

// ---------- On auth state change, ensure profile exists ----------

// db.auth.onAuthStateChange(async (event, session) => {
//   if (event === "SIGNED_IN" && session?.user) {
//     const { id, email, user_metadata } = session.user;

//     const { data: existing } = await db
//       .from("users")
//       .select("id")
//       .eq("id", id)
//       .limit(1);

//     if (!existing?.length) {
//       await db.from("users").insert([{
//         id,
//         email,
//         username: user_metadata?.preferred_username || `user_${id.slice(0, 6)}`,
//         color: "#4fb446"
//       }]);
//     }

//     console.log("✅ User verified and profile created");
//   }
// });

// ---------- Load navbar auth links ----------

async function loadNavbarAuth() {
  const authSpan = qs("nav-auth");
  if (!authSpan) return;

  // Get current session
  const { data: { session }, error } = await db.auth.getSession();
  if (!session) {
    document.getElementById("unlogged").style.display = "block";
    document.getElementById("chat-username").style.display = "inline-block";
    document.getElementById("color").style.display = "inline-block";
  } else {
    document.getElementById("unlogged").style.display = "none";
    document.getElementById("chat-username").style.display = "none";
    document.getElementById("color").style.display = "none";
  }




  if (error) {
    console.error("Auth session error:", error);
  }

  if (session?.user) {
    // Logged in
    // User is logged in
    const userId = session.user.id;
    const { data: profile, error: profileErr } = await db.from("users").select("*").eq("id", userId).single();

    const username = profile?.username || "Account";
    const color = profile?.color || "#000";

    authSpan.innerHTML = `
      <a style="margin-right:10px; font-weight:bold;">${username}</a>
      <a onclick="logout(); loadNavbarAuth()">Logout</a>
    `;
  } else {
    // Not logged in
    authSpan.innerHTML = `
      <a href="login.html">Login</a>
      <a href="register.html">Register</a>
    `;
  }
}

// Call this when page loads
document.addEventListener("DOMContentLoaded", loadNavbarAuth);


// ---------- When page loads, try to apply profile if already logged in ----------
document.addEventListener("DOMContentLoaded", async () => {
  await applyProfileToUI();
});






// send emote to chat
async function sendEmote(emoteUrl) {

  if (!window.currentUser) {
    alert("Please log in to send emotes.");
    return;
  }
  const username = document.getElementById("chat-username").value.trim() || "Anonymous";

  const { error } = await db
    .from("chat_messages")
    .insert([{ username: username, message: "", emote_url: emoteUrl }]);

  if (error) console.error("Error sending emote:", error);

  // hide picker after selection
  emotePicker.classList.add("hidden");
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

async function loadLayout() {

  
  // load navbar and footer

  document.getElementById("navbar").innerHTML =
    await (await fetch("./components/navbar.html")).text();

  document.getElementById("footer").innerHTML =
    await (await fetch("./components/footer.html")).text();

  loadNavbarAuth(); // <- Make sure this is called AFTER navbar is loaded

  // show unlogged id if not logged in
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    document.getElementById("unlogged").style.display = "block";
  } else {
    document.getElementById("unlogged").style.display = "none";
  }
}



document.addEventListener("DOMContentLoaded", loadLayout);

// 🕒 Format time as (HH:MM)
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `(${hours}:${minutes})`;
}

function addMessage(username, text, created_at, emote_url = null, color = "#000000ff") {
  // only logged in users can see messages
  //tell them they need to log in
  


  const messagesDiv = document.getElementById("messages");

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message");

  // username element
  const userSpan = document.createElement("span");
  userSpan.classList.add("chat-username");
  userSpan.textContent = `[${username}]`;
  userSpan.style.color = color;

  // message text
  const textSpan = document.createElement("span");
  textSpan.classList.add("chat-text");
  textSpan.textContent = `  ${text} `;

  // timestamp element
  const timeSpan = document.createElement("span");
  timeSpan.classList.add("chat-timestamp");
  timeSpan.textContent = formatTime(created_at);

  msgDiv.appendChild(userSpan);

  if (emote_url) {
    const emoteImg = document.createElement("img");
    emoteImg.src = emote_url;
    emoteImg.classList.add("chat-emote");
    msgDiv.appendChild(emoteImg);
  } else {
    const textSpan = document.createElement("span");
    textSpan.classList.add("chat-text");
    textSpan.textContent = `: ${text}`;
    msgDiv.appendChild(textSpan);
  }

  msgDiv.appendChild(timeSpan);
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


// 💬 Send message
async function sendMessage() {
  // const username =
  //   document.getElementById("chat-username").value.trim() || "Anonymous";
  // if user is logged in
  if (!window.currentUser) {
    alert("Please log in to send messages.");
    return;
  }
  const username = window.currentUser?.username || "Guest";
  const text = document.getElementById("chat-input").value.trim();
  if (!text) return;

  // const color = document.getElementById('color').value;
  const color = window.currentUser?.color || "#000000ff";
  const level = window.currentUser?.level || 1;
  const role = "";
  if (level == 2) {
    role = "(Verified)";
  } else if (level == 3) {
    role = "(Moderator)";
  } else if (level == 4) {
    role = "(Admin)";
  }

  const { error } = await db
    .from("chat_messages")
    .insert([{ username: username, message: text, color }]);

  if (error) console.error("Error sending message:", error);

  document.getElementById("chat-input").value = "";
}

// make pressing Enter send the message
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("chat-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); // stop newlines
        sendMessage();
      }
    });
  }
});


// 🔄 Load old messages
// load existing messages (supports emotes)
async function loadMessages() {
  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading messages:", error);
    return;
  }

  data.forEach((msg) => addMessage(msg.username, msg.message, msg.created_at, msg.emote_url, msg.color));

}

document.addEventListener("DOMContentLoaded", async () => {
  await applyProfileToUI(); // wait until user loaded
  if (window.currentUser) {
    await loadMessages(); // only load messages after profile is ready
  }
});


// ⚡ Real-time message updates (no refresh)
// update real-time listener to include emote_url
db.channel("chat")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
    const msg = payload.new;
    addMessage(msg.username, msg.message, msg.created_at, msg.emote_url, msg.color);
  })
  .subscribe();

document.addEventListener("DOMContentLoaded", loadMessages);

