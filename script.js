const db = supabase.createClient(
    "https://zdtpcfxzncehhnvmglsj.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHBjZnh6bmNlaGhudm1nbHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MzcwMDYsImV4cCI6MjA3ODQxMzAwNn0.vlwKNgq0Gqyg7e747O7s3KCVw2J9bZQfS5zzW78X6RY"
);

// ---------- Helpers ----------
function qs(id) { return document.getElementById(id); }
function showAlert(msg) { alert(msg); } // replace with custom UI later

let lastMessageUser = null; // track last message sender
let lastReadMessageId = null; // track last read message ID
let unreadCount = 0; // count of unread messages

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
      <a onclick="logout(); loadNavbarAuth()">Logout</a>
      <a href="account.html" style="margin-right:10px; font-weight:bold;">${username}</a>
      <a href="post.html" style="margin-right:10px;">New Post</a>
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
    .insert([{ username: username, message: "", emote_url: emoteUrl, color: window.currentUser?.color || "#000000ff", role: levelToRole(window.currentUser?.level), profile_image: window.currentUser?.profile_image || 'media/pfp.png' }]);

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


// 🕒 Format time as DD/MM/YYYY HH:MM PM / AM
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const userLocalDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  //format date to DD/MM/YYYY HH:MM

  return `${userLocalDate.getDate()}/${userLocalDate.getMonth() + 1}/${userLocalDate.getFullYear()} ${hours}:${minutes}`;
}

function toggleMedia() {
  const emotes = document.querySelectorAll('.chat-emote');
  emotes.forEach(emote => {
    if (emote.style.display === 'none') {
      emote.style.display = 'inline';
    } else {
      emote.style.display = 'none';
    }
  });
}


function addMessage(username, text, created_at, emote_url = null, color = "#000000ff", role="", profile_pic=null, messageId=null, isInitialLoad=false) {
  // only do this if messages div exists
  if (!document.getElementById("messages")) return;

  const messagesDiv = document.getElementById("messages");

    // check if this msg is same sender as last one
  const isSameUserAsLast = (username === lastMessageUser);

  const wrapper = document.createElement("div");
  wrapper.classList.add("chat-message");
  wrapper.setAttribute('data-message-id', messageId); // Add message ID for tracking

  // Check if message is deleted
  const isDeleted = text === "this message was deleted";

  // left column (pfp area)
  const left = document.createElement("div");
  left.classList.add("chat-left");

  // right column
  const right = document.createElement("div");
  right.classList.add("chat-right");


    // Main content
    const content = document.createElement("div");
    content.classList.add("chat-content");



  if (!isSameUserAsLast && !isDeleted) {
      const pfp = document.createElement("img");
      pfp.classList.add("chat-pfp");
      pfp.src = profile_pic || "media/pfp.png";
      left.appendChild(pfp);

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

      right.appendChild(header);

  } else {
    // keep space but hide pfp (for same user or deleted)
    const spacer = document.createElement("div");
    spacer.classList.add("chat-pfp-spacer");
    left.appendChild(spacer);

    // same user group → shrink vertical spacing
    wrapper.classList.add("same-user");
}


  // Body (text/emote + timestamp)
  const body = document.createElement("div");
  body.classList.add("chat-body");

  // Content wrapper for message
  const contentSpan = document.createElement("span");
  contentSpan.classList.add("message-content");

  if (isDeleted) {
    contentSpan.classList.add("deleted-message");
  }

  if (isDeleted) {
    const textSpan = document.createElement("span");
    textSpan.classList.add("chat-text");
    textSpan.textContent = text;
    contentSpan.appendChild(textSpan);
  } else if (emote_url) {
    const emoteImg = document.createElement("img");
    emoteImg.src = emote_url;
    emoteImg.classList.add("chat-emote");
    contentSpan.appendChild(emoteImg);
  } else {
    const textSpan = document.createElement("span");
    textSpan.classList.add("chat-text");
    textSpan.textContent = text;
    contentSpan.appendChild(textSpan);
  }

  body.appendChild(contentSpan);

  const timeSpan = document.createElement("span");
  timeSpan.classList.add("chat-timestamp");
  timeSpan.textContent = formatTime(created_at);
  body.appendChild(timeSpan);

  // Add delete button for moderators/admins (level 3+) to the right of timestamp, but not for deleted messages
  if (window.currentUser && window.currentUser.level >= 3 && messageId && !isDeleted) {
    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("delete-message-btn");
    deleteBtn.textContent = "❌";
    deleteBtn.onclick = () => deleteMessage(messageId);
    body.appendChild(deleteBtn);
  }

  // Build final structure
  right.appendChild(body);
  wrapper.appendChild(left);
  wrapper.appendChild(right);
  messagesDiv.appendChild(wrapper);

  // For initial load, don't increment unread count or auto-scroll
  if (!isInitialLoad) {
    // Always auto-scroll to bottom for new messages
    // Use setTimeout to ensure DOM has updated before scrolling
    setTimeout(() => {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 0);

    // Mark as read if window is focused (since it always scrolls to bottom)
    if (document.hasFocus() && messageId) {
      lastReadMessageId = messageId;
      localStorage.setItem('lastReadMessageId', lastReadMessageId);
      unreadCount = 0;
      updateUnreadCounter();
      updateLastReadIndicator();
      updateDocumentTitle();
    } else {
      // Increment unread count if not focused
      if (messageId && messageId !== lastReadMessageId) {
        unreadCount++;
        updateUnreadCounter();
        updateLastReadIndicator();
        updateDocumentTitle();
      }
    }
  }

  // Update last read indicator after adding the message (only for real-time messages)
  if (!isInitialLoad) {
    updateLastReadIndicator();
  }

  lastMessageUser = username;
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
  const profile_image = window.currentUser?.profile_image || 'media/pfp.png';

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

  // Load last read message ID from localStorage
  lastReadMessageId = localStorage.getItem('lastReadMessageId');

  data.forEach((msg) => addMessage(msg.username, msg.message, msg.created_at, msg.emote_url, msg.color, msg.role, msg.profile_image, msg.id, true));

  // Set last read to the most recent message if not set
  if (!lastReadMessageId && data.length > 0) {
    lastReadMessageId = data[data.length - 1].id;
    localStorage.setItem('lastReadMessageId', lastReadMessageId);
  }

  // Calculate unread count: messages after lastReadMessageId
  if (lastReadMessageId) {
    const lastReadIndex = data.findIndex(msg => msg.id === lastReadMessageId);
    if (lastReadIndex !== -1) {
      unreadCount = data.length - 1 - lastReadIndex;
    } else {
      // If lastReadMessageId not found (e.g., old message), assume all read and set to last
      unreadCount = 0;
      lastReadMessageId = data[data.length - 1].id;
      localStorage.setItem('lastReadMessageId', lastReadMessageId);
    }
  } else {
    unreadCount = data.length;
  }

  updateUnreadCounter();
  // Update last read indicator after initial load
  updateLastReadIndicator();
  // Update document title after initial load
  updateDocumentTitle();

  // Scroll to last read message if it exists
  if (lastReadMessageId) {
    const lastReadMessage = document.querySelector(`[data-message-id="${lastReadMessageId}"]`);
    if (lastReadMessage) {
      lastReadMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}


document.addEventListener("DOMContentLoaded", initPage);

async function initPage() {
  await loadLayout();        // navbar + footer load
  await applyProfileToUI();  // load currentUser AFTER navbar loads

  if (window.currentUser) {
    await loadMessages();    // NOW messages will load correctly

    // ⚡ Real-time message updates (no refresh) - only subscribe if logged in
    db.channel("chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new;
        addMessage(msg.username, msg.message, msg.created_at, msg.emote_url, msg.color, msg.role, msg.profile_image, msg.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
        const updatedMsg = payload.new;
        // Remove old message element
        const oldElement = document.querySelector(`[data-message-id="${updatedMsg.id}"]`);
        if (oldElement) {
          oldElement.remove();
        }
        // Re-add updated message
        addMessage(updatedMsg.username, updatedMsg.message, updatedMsg.created_at, updatedMsg.emote_url, updatedMsg.color, updatedMsg.role, updatedMsg.profile_image, updatedMsg.id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        const deletedId = payload.old.id;
        const messageElement = document.querySelector(`[data-message-id="${deletedId}"]`);
        if (messageElement) {
          messageElement.remove();
        }
      })
      .subscribe();
  } else {
    // For non-logged-in users, show a message or hide the chat
    const messagesDiv = document.getElementById("messages");
    if (messagesDiv) {
      messagesDiv.innerHTML = "<p>Please log in to view messages.</p>";
    }
  }

  setupChatInput();
  setupResizeHandle();
  setupScrollRead();

  // Update last read indicator on window focus
  window.addEventListener('focus', () => {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
      const isAtBottom = messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10;
      if (isAtBottom && unreadCount > 0) {
        // Mark all as read when focusing and at bottom
        const lastMessage = messagesDiv.querySelector('.chat-message:last-child');
        if (lastMessage) {
          const messageId = lastMessage.getAttribute('data-message-id');
          if (messageId) {
            lastReadMessageId = messageId;
            localStorage.setItem('lastReadMessageId', lastReadMessageId);
            unreadCount = 0;
            updateUnreadCounter();
            updateLastReadIndicator();
          }
        }
      }
    }
  });
}


// ⚡ Real-time message updates (no refresh)
// Moved to initPage() to only subscribe if logged in


// ---------- Profile Image Upload ----------

async function uploadProfilePicture() {
  const file = document.getElementById("profile-pic-file").files[0];
  if (!file) return alert("select a pic lil bro");

  const { data: userData } = await db.auth.getUser();
  const user = userData?.user;
  if (!user) return alert("u gotta log in fam");

  const fileName = `${user.id}_${Date.now()}.${file.name.split(".").pop()}`;

  // Upload to bucket

  const { data: uploadData, error: uploadErr } = await db
    .storage
    .from("profile_pics")
    .upload(fileName, file, { upsert: true });

  if (uploadErr) {
    console.error(uploadErr);
    alert("Upload failed.");
    return;
  }

  // Get full public URL
  const { data: publicUrlData } = db
    .storage
    .from("profile_pics")
    .getPublicUrl(fileName);

  const publicUrl = publicUrlData.publicUrl;



  // Update DB row
  const { error: updateErr } = await db
    .from("users")
    .update({ profile_image: publicUrl })
    .eq("id", user.id);

  if (updateErr) {
    console.error(updateErr);
    alert("Failed to update profile.");
    return;
  }

  alert("Profile picture updated!");


}



function getPublicProfileImage(userId, ext = "png") {
  return db.storage
    .from("profile_pics")
    .getPublicUrl(`${userId}.${ext}`).data.publicUrl;
}

// ---------- Resize Handle Functionality ----------

function setupResizeHandle() {
  const resizeHandle = document.querySelector('.resize-handle');
  const chatBox = document.querySelector('.chat-box');
  const messagesDiv = document.querySelector('.messages');

  if (!resizeHandle || !chatBox || !messagesDiv) return;

  let isResizing = false;
  let startY;
  let startHeight;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = chatBox.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaY = e.clientY - startY;
    const newHeight = startHeight + deltaY;

    if (newHeight >= 300) { // Minimum height
      chatBox.style.height = newHeight + 'px';
      // No need to set messagesDiv height explicitly, as flex: 1 will handle it
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// Update unread message counter
function updateUnreadCounter() {
  const header = document.querySelector('.chat-header');
  if (!header) return;

  // Remove existing counter
  const existingCounter = header.querySelector('.unread-counter');
  if (existingCounter) {
    existingCounter.remove();
  }

  if (unreadCount > 0) {
    const counter = document.createElement('span');
    counter.classList.add('unread-counter');
    counter.textContent = ` (${unreadCount} unread)`;
    counter.style.color = 'red';
    counter.style.fontWeight = 'bold';
    header.appendChild(counter);
  }
}

// Update document title with unread count
function updateDocumentTitle() {
  const baseTitle = "Messages";
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}

// Mark messages as read when scrolling to bottom and window is focused
function setupScrollRead() {
  const messagesDiv = document.getElementById('messages');
  if (!messagesDiv) return;

  messagesDiv.addEventListener('scroll', () => {
    const isAtBottom = messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10;
    const isWindowFocused = document.hasFocus();
    if (isAtBottom && isWindowFocused && unreadCount > 0) {
      // Find the last message ID
      const lastMessage = messagesDiv.querySelector('.chat-message:last-child');
      if (lastMessage) {
        const messageId = lastMessage.getAttribute('data-message-id');
        if (messageId) {
          lastReadMessageId = messageId;
          localStorage.setItem('lastReadMessageId', lastReadMessageId);
          unreadCount = 0;
          updateUnreadCounter();
          updateLastReadIndicator();
          updateDocumentTitle();
        }
      }
    }
  });
}

// Update last read indicator position
function updateLastReadIndicator() {
  // Remove existing indicators
  const existingIndicators = document.querySelectorAll('.last-read-indicator');
  existingIndicators.forEach(indicator => indicator.remove());

  if (!lastReadMessageId) return;

  // Find the message with the last read ID
  const lastReadMessage = document.querySelector(`[data-message-id="${lastReadMessageId}"]`);
  if (lastReadMessage && unreadCount > 0) {
    // Insert indicator after the message
    const indicator = document.createElement("div");
    indicator.classList.add("last-read-indicator");
    const span = document.createElement("span");
    span.textContent = "Last Read";
    indicator.appendChild(span);
    lastReadMessage.parentNode.insertBefore(indicator, lastReadMessage.nextSibling);
  }
}

// Delete message function for moderators/admins
async function deleteMessage(messageId) {
  if (!window.currentUser || window.currentUser.level < 3) {
    alert("You do not have permission to delete messages.");
    return;
  }

  if (!confirm("Are you sure you want to delete this message?")) {
    return;
  }

  const { error } = await db
    .from("chat_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    console.error("Error deleting message:", error);
    alert("Failed to delete message.");
    return;
  }

  // Immediately remove the message element from the UI
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    messageElement.remove();
  }

  // Reload messages to fix grouping after deletion
  await loadMessages();
}


async function uploadPost() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("select a pic lil bro");

  const { data: userData } = await db.auth.getUser();
  const user = userData?.user;
  if (!user) return alert("u gotta log in fam");

  const fileName = `${user.id}_${Date.now()}.${file.name.split(".").pop()}`;

  // Upload to bucket

  const { data: uploadData, error: uploadErr } = await db
    .storage
    .from("posts")
    .upload(fileName, file, { upsert: true });

  if (uploadErr) {
    console.error(uploadErr);
    alert("Upload failed.");
    return;
  }

  // Get full public URL
  const { data: publicUrlData } = db
    .storage
    .from("posts")
    .getPublicUrl(fileName);

  const publicUrl = publicUrlData.publicUrl;



  // Add post to post table in DB
  const { error: updateErr } = await db
    .from("posts")
    .insert({
      user_id: user.id,
      image_url: publicUrl,
      caption: document.getElementById("captionInput").value
    });

  if (updateErr) {
    console.error(updateErr);
    alert("Failed to add post.");
    return;
  }

  alert("Posted!");


}

document.addEventListener("DOMContentLoaded", async () => {
  await getCurrentUser();
  loadPosts();
  
});

let currentUser = null;

async function getCurrentUser() {
  const { data } = await db.auth.getUser();
  currentUser = data.user;
}



async function loadPosts() {
  let likedPostIds = new Set();

  if (currentUser) {
    const { data: likes, error: likesErr } = await db
      .from("post_likes")
      .select("post_id")
      .eq("user_id", currentUser.id);

    if (!likesErr && likes) {
      likedPostIds = new Set(likes.map(l => l.post_id));
      console.log(likedPostIds);
    } else if (likesErr) {
      console.error("Error fetching likes:", likesErr);
    }
  }

  const container = document.getElementById("posts-container");
  if (!container) return;

  const { data: posts, error } = await db
    .from("posts")
    .select(`
      id,
      image_url,
      caption,
      created_at,
      users (
        username,
        profile_image
      ),
      post_likes ( count )
    `)
    .order("created_at", { ascending: false });


  if (error) {
    console.error("loadPosts error:", error);
    return;
  }

  container.innerHTML = "";

  posts.forEach(post => {
    const username = post.users?.username || "unknown";
    const profileImage = post.users?.profile_image || "media/pfp.png";
    const isLiked = likedPostIds.has(post.id);
    console.log(isLiked)
    let likeClass = "";
    if (isLiked) {
      likeClass = "clicked";
    }

    const postEl = document.createElement("div");
    postEl.className = "post";

    postEl.innerHTML = `
      <div class="post-header">
        <div class="post-header-left">
          <img src="${profileImage}" class="post-pfp" />
        </div>
        <div class="post-header-right">
          <span class="post-username">@${username}</span>
        </div>
      </div>

      <div class="post-content">
        ${post.image_url.endsWith('.mp4') 
            ? `<video class="post-video" src="${post.image_url}" controls autoplay muted loop></video>` 
            : `<img src="${post.image_url}" class="post-image" />`
        }
        ${post.caption ? `<p class="caption">${post.caption}</p>` : ""}
        <span class="post-timestamp">${formatTime(post.created_at)}</span>
      </div>

      <div class="post-interactions">
        <button class="icon-btn like-btn ${likeClass}" data-post-id="${post.id}">
          <img src="media/icons/heart-unclicked.svg" class="like-unclicked-icon" />
          <img src="media/icons/heart-clicked.svg" class="like-clicked-icon" />
        </button>
        <span class="like-count">${post.post_likes.length}</span>
        <button class="icon-btn comment-btn">
          <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.97 122.88"><title>instagram-comment</title><path d="M61.44,0a61.46,61.46,0,0,1,54.91,89l6.44,25.74a5.83,5.83,0,0,1-7.25,7L91.62,115A61.43,61.43,0,1,1,61.44,0ZM96.63,26.25a49.78,49.78,0,1,0-9,77.52A5.83,5.83,0,0,1,92.4,103L109,107.77l-4.5-18a5.86,5.86,0,0,1,.51-4.34,49.06,49.06,0,0,0,4.62-11.58,50,50,0,0,0-13-47.62Z"/></svg>
        </button>
        <span>0</span>
        <button class="icon-btn save-btn">
          <svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 459 511.87"><path fill-rule="nonzero" d="M32.256 0h394.488c8.895 0 16.963 3.629 22.795 9.462C455.371 15.294 459 23.394 459 32.256v455.929c0 13.074-10.611 23.685-23.686 23.685-7.022 0-13.341-3.07-17.683-7.93L230.124 330.422 39.692 505.576c-9.599 8.838-24.56 8.214-33.398-1.385a23.513 23.513 0 01-6.237-16.006L0 32.256C0 23.459 3.629 15.391 9.461 9.55l.089-.088C15.415 3.621 23.467 0 32.256 0zm379.373 47.371H47.371v386.914l166.746-153.364c8.992-8.198 22.933-8.319 32.013.089l165.499 153.146V47.371z"/></svg>
        </button>
        <span>0</span>
        <button class="icon-btn share-btn">
          <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 108.3"><title>instagram-share</title><path d="M96.14,12.47l-76.71-1.1,28.3,27.85L96.14,12.47ZM53.27,49l9.88,39.17L102.1,22,53.27,49ZM117,1.6a5.59,5.59,0,0,1,4.9,8.75L66.06,105.21a5.6,5.6,0,0,1-10.44-1.15L41.74,49,1.67,9.57A5.59,5.59,0,0,1,5.65,0L117,1.6Z"/></svg>
        </button>
        <span>0</span>
      </div>
    `;

    container.appendChild(postEl);
    const likeBtn = postEl.querySelector(".like-btn");
    const unclickedIcon = likeBtn.querySelector(".like-unclicked-icon");
    const clickedIcon = likeBtn.querySelector(".like-clicked-icon");

    if (isLiked) {
      unclickedIcon.style.display = "none";
      clickedIcon.style.display = "block";
    } else {
      clickedIcon.style.display = "none";
      unclickedIcon.style.display = "block";
    }
  });
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".like-btn");
  if (!btn) return;

  if (!currentUser) {
    alert("login first bro");
    return;
  }

  const postId = parseInt(btn.dataset.postId, 10);
  if (!postId) return;

  const unclickedIcon = btn.querySelector(".like-unclicked-icon");
  const clickedIcon = btn.querySelector(".like-clicked-icon");

  const clicked = btn.classList.contains("clicked");

  if (clicked) {
    const { error } = await db
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);

    if (error) return console.error(error);

    clickedIcon.style.display = "none";
    unclickedIcon.style.display = "block";
    btn.classList.remove("clicked");
  } else {
    const { error } = await db
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: currentUser.id
      });

    if (error) return console.error(error);

    unclickedIcon.style.display = "none";
    clickedIcon.style.display = "block";
    btn.classList.add("clicked");
  }
});
