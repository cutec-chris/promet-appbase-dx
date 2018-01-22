var fLogin,fLayout,fToolbar,fLoginPopup;
{
  var fLayout = new dhtmlXLayoutObject({
    parent: document.body,
        pattern: "1C",
        offsets: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
  });
  var a = fLayout.cells('a');
  a.hideHeader();
  fToolbar = a.attachToolbar({
      items:[
         {id: "login", type: "button", img: "fa fa-sign-in"}
      ],
    iconset: "awesome"
  });
  fLoginPopup = new dhtmlXPopup({ toolbar: fToolbar, id: "login" });
  formStructure = [
      {type: "settings", position: "label-left", labelWidth: 110, inputWidth: 130},
      {type: "fieldset",name:"data", label: "Anmelden", list:[
          {type: "input", name: 'server', label: 'Server', value: 'http://localhost:8085'},
          {type:"input", name:"name", label:"Benutzername"},
          {type:"password", name:"pass", label:"Passwort"},
          {type:"checkbox", name:"store", label:"Login in Cookie speichern"},
          {type:"button", name:"save", value:"Login"}
      ]},
      {type: "fieldset",name:"logoutdata", label: "Abmelden", list:[
        {type:"button", name:"logout", value:"Logout"}
      ]}
  ];
  fLogin = fLoginPopup.attachForm(formStructure);
  fLoginPopup.setDimension(170,270);
  parent.AvammLogin = parent.getCookie('login');
  if (parent.AvammLogin == '') parent.AvammLogin = null;
  parent.AvammServer = parent.getCookie('server');
  fLogin.hideItem("server");
  fLogin.setItemValue("server","");
  parent.LoadData('/configuration/status',function(Data){
   if ((Data)&&(Data.xmlDoc)) {
      if (Data.xmlDoc.status == 200) { // No Configuration found
        dhtmlx.message({
          type : "info",
          text: "Server muss konfiguriert werden",
          expire: 1000
        });
        parent.window.location.href = 'config/install.html';
     } else if ((Data)&&(Data.xmlDoc)&&(Data.xmlDoc.status!=0)) {
       console.log("server reachable "+Data.xmlDoc.status);
     } else {
       dhtmlx.message({
         type : "info",
         text: "kein Server erreichbar, bitte geben Sie einen Server an",
         expire: 15000
       });
       fLogin.showItem("server");
       fLogin.setItemValue("server",parent.AvammServer);
     }
   } else {
     dhtmlx.message({
       type : "info",
       text: "kein Server erreichbar, bitte geben Sie einen Server an",
       expire: 15000
     });
     fLogin.showItem("server");
     fLogin.setItemValue("server",parent.AvammServer);
   }
  },true);
  if (parent.AvammLogin) {
    parent.LoadData('/configuration/userstatus',function(aData){
      if ((aData)&&(aData.xmlDoc))
      if (aData.xmlDoc.responseText != '') {
        parent.Avamm.User = JSON.parse(aData.xmlDoc.responseText);
        fLogin.hideItem("data");
        fLoginPopup.setDimension(170,100);
        console.log('Login with Cookie');
        if (parent.Avamm.AfterLogin) {
          try {
            parent.Avamm.AfterLogin(atob(parent.AvammLogin).split(':')[0],fLayout);
          } catch(err) {
            throw err;
          }
          parent.window.dispatchEvent(parent.Avamm.AfterLoginEvent);
        }
      }
    });
  } else {
    fLogin.hideItem("logoutdata");
    fLoginPopup.show("login");
  }
  fLogin.attachEvent("onButtonClick",function(buttonID){
    if(buttonID=="save"){
      if (fLogin.getItemValue("name")=="") {
              dhtmlx.message({
                type : "error",
                text: "Bitte Benutzer angeben",
                expire: 5000
              });
      } else {
        parent.DoLogin(btoa(fLogin.getItemValue("name")+":"+fLogin.getItemValue("pass")),fLogin.getItemValue("server"),function(data){
          if (data) {
            if (data.xmlDoc.readyState == 4 && data.xmlDoc.status == 404) {
              console.log('succesful login');
              dhtmlx.message({
                text: "Login erfolgreich",
                expire: 3000
              });
              if (fLogin.getItemValue("store")==1) {
                parent.setCookie('login',btoa(fLogin.getItemValue("name")+":"+fLogin.getItemValue("pass")));
                parent.setCookie('server',fLogin.getItemValue("server"));
                console.log('cookies set...');
              }
              parent.LoadData('/configuration/userstatus',function(aData){
                if ((aData)&&(aData.xmlDoc))
                if (aData.xmlDoc.responseText != '') {
                  parent.Avamm.User = JSON.parse(aData.xmlDoc.responseText);
                  fLogin.hideItem("data");
                  fLogin.showItem("logoutdata");
                  document.getElementById("realForm").submit();
                  console.log('Login from User');
                  fLoginPopup.setDimension(170,100);
                  if (parent.Avamm.AfterLogin) {
                    try {
                      parent.Avamm.AfterLogin(atob(parent.AvammLogin).split(':')[0],fLayout);
                    } catch(err) {
                      throw err;
                    }
                    parent.window.dispatchEvent(parent.Avamm.AfterLoginEvent);
                    fLoginPopup.hide("login");
                  }
                }
              });
            } else {
              console.log('unsuccesful login '+data.status);
              dhtmlx.message({
                type : "error",
                text: "Login nicht erfolgreich",
                expire: 5000
              });
            }
          } else {
            console.log('server not reachable');
            dhtmlx.message({
              type : "error",
              text: "Server nicht erreichbar",
              expire: 15000
            });
          }
        });
      }
    }
    if(buttonID=="logout"){
      fLogin.hideItem("logoutdata");
      fLogin.showItem("data");
      parent.AvammLogin = null;
      parent.deleteCookie('login');
      console.log("logout, User cleared");
      parent.window.dispatchEvent(parent.Avamm.AfterLogoutEvent);
      dhtmlx.message({
        text: "Logout erfolgreich",
        expire: 3000
      });
      fLayout.cells('a').attachHTMLString('');
    }
  });
}
