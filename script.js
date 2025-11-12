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


// toggle emote picker visibility
const emoteBtn = document.getElementById("emote-btn");
const emotePicker = document.getElementById("emote-picker");

if (emoteBtn) {
  emoteBtn.addEventListener("click", () => {
    emotePicker.classList.toggle("hidden");
  });
}

// send emote to chat
async function sendEmote(emoteUrl) {
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
  document.getElementById("navbar").innerHTML =
    await (await fetch("components/navbar.html")).text();

  document.getElementById("footer").innerHTML =
    await (await fetch("components/footer.html")).text();
}



document.addEventListener("DOMContentLoaded", loadLayout);

// 🕒 Format time as (HH:MM)
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `(${hours}:${minutes})`;
}

function addMessage(username, text, created_at, emote_url = null) {
  const messagesDiv = document.getElementById("messages");

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message");

  // username element
  const userSpan = document.createElement("span");
  userSpan.classList.add("chat-username");
  userSpan.textContent = `[${username}]`;

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
  const username =
    document.getElementById("chat-username").value.trim() || "Anonymous";
  const text = document.getElementById("chat-input").value.trim();
  if (!text) return;

  const { error } = await db
    .from("chat_messages")
    .insert([{ username: username, message: text }]);

  if (error) console.error("Error sending message:", error);

  document.getElementById("chat-input").value = "";
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

  data.forEach((msg) => addMessage(msg.username, msg.message, msg.created_at, msg.emote_url));
}

// ⚡ Real-time message updates (no refresh)
// update real-time listener to include emote_url
db.channel("chat")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
    const msg = payload.new;
    addMessage(msg.username, msg.message, msg.created_at, msg.emote_url);
  })
  .subscribe();

document.addEventListener("DOMContentLoaded", loadMessages);