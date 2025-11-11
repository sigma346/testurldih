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

// listen for new messages (realtime)
db
  .channel('chat')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    payload => {
      const msg = payload.new;
      addMessage(msg.username, msg.message, msg.created_at);
    }
  )
  .subscribe();

// send messages
async function sendMessage() {
  const username = document.getElementById("chat-username").value;
  const text = document.getElementById("chat-input").value;

  if (!text.trim()) return;

  await db.from("chat_messages").insert([
    { username: username || "Anonymous", message: text }
  ]);

  document.getElementById("chat-input").value = "";
}

// render message
function addMessage(username, text, time) {
  const msgContainer = document.getElementById("messages");
  const messageEl = document.createElement("div");
  messageEl.textContent = `[${username}] ${text}`;
  msgContainer.appendChild(messageEl);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

// load chat history on page open
async function loadMessages() {
  const { data } = await db
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });

  data.forEach(msg => addMessage(msg.username, msg.message, msg.created_at));
}

loadMessages();
