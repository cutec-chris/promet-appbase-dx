var sbMain;
var lMain;
var AvammUser,AvammPasswd,AvammServer;

function RegisterAvammAppPage(caption,name,src) {
  sbMain.addItem({id: 'si'+name, text: caption, AppID: name, AppSrc: src, icon: ''});
  sbMain.cells('si'+name).attachURL(src);
}

function InitAvammApp(){
  window.dhx4.skin = 'material';
  sbMain =  new dhtmlXSideBar({parent: document.body,template: 'text', width: '200', icons_path: './codebase/imgs_sidebar/', autohide: ''});
  dhtmlXSideBar.prototype.templates.icontext =
  // icon 32x32
  "<img class='dhxsidebar_item_icon' src='#icons_path##icon#' border='0'>"+
  // general area for text
  "<div class='dhxsidebar_item_text'>"+
    "<div class='line_one'>#text#</div>"+ // 1st line of text
    "<div class='line_two'>#text2#</div>"+ // 2nd line of text
  "</div>";
  dhtmlXSideBar.prototype.templates.text =
  // general area for text
  "<div class='dhxsidebar_item_text'>"+
    "<a class='line' id='#AppID#' href='#AppSrc#' default>#text#</section>"+
  "</div>";
  if (!AvammUser) {
    RegisterAvammAppPage('Login','login','appbase/login.html');
    sbMain.cells('silogin').setActive();
  }
};

function StartAvammApp(){
};

function LoadData(Url,Callback) {
  if (AvammUser) {
    dhx.ajax.timeout = 1000;
    var aTimeout = window.setTimeout(Callback,1000);
    dhx.ajax.query
      ({
        method: "GET",
        url: AvammServer+Url,
        dataType: "json",
        async: true,
        headers: {
                "Authorization": "Basic " + btoa(AvammUser + ":" + AvammPasswd)
                },
        callback: function (data){
          window.clearTimeout(aTimeout);
          if (Callback)
            Callback(data);
        }
      });
}}

function DoLogin(aName,aPasswd,aServer,Callback) {
  console.log("Login of "+aName);
  var Data;
  AvammUser = aName;
  AvammPasswd = aPasswd;
  AvammServer = aServer;
  LoadData("/",function(Data){ if (Callback) Callback(Data);});
}
