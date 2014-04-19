function OnConnected() {
  console.log("were connected");
  link=document.createElement('a');
  link.className="toolbutton";
  link.id="loginButton";
  function DoLogin() {
    loadPage("base/login.html");
  }
  link.addEventListener('click',DoLogin);
  document.getElementById('systray').appendChild(link);
}
function OnDisconnected() {
  console.log("were disconnected");
  link = document.getElementById('loginButton');
  if (link) {
    link.parentNode.removeChild(link);
  }
  link = document.getElementById('logoutButton');
  if (link) {
    link.parentNode.removeChild(link);
  }
}
function OnLoggedIn() {
  console.log("were logged in");
  link = document.getElementById('loginButton');
  if (link) {
    link.parentNode.removeChild(link);
  }
  link=document.createElement('a');
  link.className="toolbutton";
  link.id="logoutButton";
  link.addEventListener('click',DoLogout);
  document.getElementById('systray').appendChild(link);
  FConnectionOK=true;
}

