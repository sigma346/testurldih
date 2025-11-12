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

function addMessage(username, text, created_at) {
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

  // assemble message
  msgDiv.appendChild(userSpan);
  msgDiv.appendChild(textSpan);
  msgDiv.appendChild(timeSpan);

  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight; // auto scroll
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
async function loadMessages() {
  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading messages:", error);
    return;
  }

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  data.forEach((msg) => addMessage(msg.username, msg.message, msg.created_at));
}

// ⚡ Real-time message updates (no refresh)
db.channel("chat")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "chat_messages" },
    (payload) => {
      const msg = payload.new;
      addMessage(msg.username, msg.message, msg.created_at);
    }
  )
  .subscribe();

document.addEventListener("DOMContentLoaded", loadMessages);