if (loadOption("prometUser")!=null)
  Params.User = loadOption("prometUser");
if (document.getElementById('eUser'))
  document.getElementById('eUser').value = Params.User;
if (Params.User)
  document.getElementById('loginform').elements["ePass"].focus();
function SubmitLogin(){
  return LoginStep1(document.getElementById('eUser').value, document.getElementById('ePass').value);
}
function LoginStep1(usr, passw){
  user = usr;
  password = passw;
  document.getElementById('loginform').elements["ePass"].value="";
  DoGet("http://"+Params.Server+"/?action=login&step=1&name="+encodeURIComponent(usr)+"&random="+encodeURIComponent(Math.random()));
  LoginTimer = window.setTimeout("LoginTimeout()", 500);
  return false;
}
function LoginTimeout(){
  window.clearTimeout(LoginTimer);
  document.getElementById('loginform').elements["ePass"].focus();
  alert("Login fehlgeschlagen !");
}
function LoginStep2(salt){
  window.clearTimeout(LoginTimer);
  var Result="";
  var apw = password;
  for(i=0;i<password.length;i++)
    {
      Result += salt.substring(0,5);
      salt = salt.substring(5,salt.length);
      Result += apw.substring(0,1);
      apw = apw.substring(1,apw.length);
    }
  password=CryptoJS.SHA1(Result);
  DoGet("http://"+Params.Server+"/?action=login&step=2&p="+encodeURIComponent(password)+"&random="+encodeURIComponent(Math.random()));
  LoginTimer = window.setTimeout("LoginTimeout()", 500);
}
function LoginComplete(){
  window.clearTimeout(LoginTimer);
  if (OnLoggedIn != null)
    OnLoggedIn();
  link = document.getElementsByClassName('back')[0];
  if (link) {
    link.click();
  } else {
    loadPage('#');
  }
  Params.User = document.getElementById('eUser').value;
  storeOption("prometUser",document.getElementById('eUser').value);
}

