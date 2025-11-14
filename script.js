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
  applyProfileToUI();
  showAlert("Logged in.");

  // await loadNavbarAuth(); // update navbar buttons

  // redirect to messages page
  window.location.href = "index.html";
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

async function applyProfileToUI() {
  const { data: userData } = await db.auth.getUser();
  const user = userData?.user;
  if (!user) return;

  const { data: profile, error } = await db
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.warn("No profile found:", error);
    return;
  }

  // username
  if (qs("chat-username")) {
    qs("chat-username").value = profile.username;
  }

  // profile picture
  const pfp = document.getElementById("chat-pfp");
  if (pfp && profile.profile_image) {
    const { data } = db.storage
      .from("profile_pics")
      .getPublicUrl(profile.profile_image);

    if (data?.publicUrl) {
      pfp.src = data.publicUrl;
    }
  }

  // global user object
  window.currentUser = {
    id: profile.id,
    username: profile.username,
    color: profile.color,
    level: profile.level,
    profile_image: profile.profile_image
  };
}


// ---------- Load navbar auth links ----------

async function loadNavbarAuth() {
  const authSpan = qs("nav-auth");
  if (!authSpan) return;

  // Get current session
  const { data: { session }, error } = await db.auth.getSession();
    const unloggedEl = document.getElementById("unlogged");
    const chatUsernameEl = document.getElementById("chat-username");
    const colorEl = document.getElementById("color");
      if (unloggedEl) {
        unloggedEl.style.display = session ? "none" : "block";
      }

      if (chatUsernameEl) {
        chatUsernameEl.style.display = !session ? "inline-block" : "none";
      }

      if (colorEl) {
        colorEl.style.display = !session ? "inline-block" : "none";
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
      <a href="account.html" style="margin-right:10px; font-weight:bold;">${username}</a>
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



// send emote to chat
async function sendEmote(emoteUrl) {

  const emotePicker = document.getElementById("emote-picker");
  if (!window.currentUser) {
    alert("Please log in to send emotes.");
    return;
  }
  const username = document.getElementById("chat-username").value.trim() || "Anonymous";

  const { error } = await db
    .from("chat_messages")
    .insert([{ username: username, message: "", emote_url: emoteUrl, color: window.currentUser?.color || "#000000ff", role: levelToRole(window.currentUser?.level) }]);

  if (error) console.error("Error sending emote:", error);

  // hide picker after selection
  if (emotePicker) {
    emotePicker.classList.add("hidden");
  }
}

toggleEmotePicker = () => {
  const emotePicker = document.getElementById("emote-picker");
  if (emotePicker) {
    emotePicker.classList.toggle("hidden");
  }
}

// ---------- Load navbar and footer ----------

async function loadLayout() {

  
  // load navbar and footer

  document.getElementById("navbar").innerHTML =
    await (await fetch("./components/navbar.html")).text();


  if (document.getElementById("footer")) {
    document.getElementById("footer").innerHTML =
      await (await fetch("./components/footer.html")).text();
  }


  await loadNavbarAuth(); // <- Make sure this is called AFTER navbar is loaded

  // only toggle unlogged if element exists (some pages won’t have it)
  const { data: { session } } = await db.auth.getSession();

  const unloggedEl = document.getElementById("unlogged");
  if (unloggedEl) {
    unloggedEl.style.display = session ? "none" : "block";
  }
}


// 🕒 Format time as (HH:MM)
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `(${hours}:${minutes})`;
}

function addMessage(username, text, created_at, emote_url = null, color = "#000000ff", role="", profile_pic=null) {
  // only do this if messages div exists
  if (!document.getElementById("messages")) return;
  
  const messagesDiv = document.getElementById("messages");

  const wrapper = document.createElement("div");
  wrapper.classList.add("chat-message");

  // Profile Picture
  const pfp = document.createElement("img");
  pfp.classList.add("chat-pfp");
  pfp.src = profile_pic || "media/pfp.png";
  wrapper.appendChild(pfp);

  // Main content
  const content = document.createElement("div");
  content.classList.add("chat-content");

  // Header (username + role)
  const header = document.createElement("div");
  header.classList.add("chat-header");

  const userSpan = document.createElement("span");
  userSpan.classList.add("chat-username");
  userSpan.textContent = `[${username}]`;
  userSpan.style.color = color;
  header.appendChild(userSpan);

  if (role) {
    const roleSpan = document.createElement("span");
    roleSpan.classList.add("chat-role");
    roleSpan.textContent = role;
    header.appendChild(roleSpan);
  }

  // Body (text/emote + timestamp)
  const body = document.createElement("div");
  body.classList.add("chat-body");

  if (emote_url) {
    const emoteImg = document.createElement("img");
    emoteImg.src = emote_url;
    emoteImg.classList.add("chat-emote");
    body.appendChild(emoteImg);
  } else {
    const textSpan = document.createElement("span");
    textSpan.classList.add("chat-text");
    textSpan.textContent = text;
    body.appendChild(textSpan);
  }

  const timeSpan = document.createElement("span");
  timeSpan.classList.add("chat-timestamp");
  timeSpan.textContent = formatTime(created_at);
  body.appendChild(timeSpan);

  // Build final structure
  content.appendChild(header);
  content.appendChild(body);
  wrapper.appendChild(content);
  messagesDiv.appendChild(wrapper);

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

  const level = window.currentUser?.level || 1;

  // const color = document.getElementById('color').value;
  const color = window.currentUser?.color || "#000000ff";

  const role = levelToRole(level);
  const profile_image = window.currentUser?.profile_image || '/media/pfp.png';

  const { error } = await db
    .from("chat_messages")
    .insert([{
      username,
      user_id: window.currentUser.id, // optional, good to store
      message: text,
      color,
      role,
      profile_image // store the sender's profile pic
    }]);


  if (error) console.error("Error sending message:", error);

  document.getElementById("chat-input").value = "";
}

function setupChatInput() {
  const input = document.getElementById("chat-input");
  if (!input) return;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// level to role
function levelToRole(level) {
  switch (level) {
    case 1:
      return "";
    case 2:
      return "(Verified)";
    case 3:
      return "(Moderator)";
    case 4:
      return "(Admin)";
    default:
      return "";
  }
}

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

  data.forEach((msg) => addMessage(msg.username, msg.message, msg.created_at, msg.emote_url, msg.color, msg.role, msg.profile_image));

}


document.addEventListener("DOMContentLoaded", initPage);

async function initPage() {
  await loadLayout();        // navbar + footer load
  await applyProfileToUI();  // load currentUser AFTER navbar loads

  if (window.currentUser) {
    await loadMessages();    // NOW messages will load correctly
  }

  setupChatInput();
}


// ⚡ Real-time message updates (no refresh)
// update real-time listener to include emote_url
db.channel("chat")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
    const msg = payload.new;
    addMessage(msg.username, msg.message, msg.created_at, msg.emote_url, msg.color, msg.role, window.currentUser?.profile_image);
  })
  .subscribe();


// ---------- Profile Image Upload ----------

async function uploadProfilePicture() {
    if (!window.currentUser) {
        alert("You need to log in first.");
        return;
    }

    const fileInput = document.getElementById("profile-pic-file");
    const file = fileInput.files[0];

    if (!file) {
        alert("Pick an image first.");
        return;
    }

    const userId = window.currentUser.id;

    // unique filename
    const fileName = `${userId}_${Date.now()}.${file.name.split('.').pop()}`;

    // upload image
    const { data: uploadData, error: uploadErr } = await db.storage
        .from("profile-pics")
        .upload(fileName, file);

    if (uploadErr) {
        console.error(uploadErr);
        alert("Upload failed.");
        return;
    }

    // get public URL
    const { data: urlData } = db.storage
        .from("profile-pics")
        .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    // save to user row
    const { error: updateErr } = await db
        .from("users")
        .update({ pfp: imageUrl })
        .eq("id", userId);

    if (updateErr) {
        console.error(updateErr);
        alert("Could not update profile.");
        return;
    }

    // update session data
    window.currentUser.pfp = imageUrl;

    alert("Profile picture updated!");
}


function getPublicProfileImage(userId, ext = "png") {
  return db.storage
    .from("profile_pics")
    .getPublicUrl(`${userId}.${ext}`).data.publicUrl;
}

