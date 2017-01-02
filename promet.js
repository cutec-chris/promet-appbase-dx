var sbMain;
var lMain;
var AvammUser,AvammPasswd;

function RegisterAvammAppPage(caption,name,src) {
  sbMain.addItem({id: 'si'+name, text: caption, AppID: name, AppSrc: src, icon: ''});
  sbMain.cells('si'+name).attachURL(src);
}

function InitAvammApp(){                          //provides your script as a handler of the 'onload' HTML event

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
  }
};

function DoLogin() {
  var myForm, formData;
  var dhxWins, w1;
  formData = [
	      {type: "settings", position: "label-left", labelWidth: 100, inputWidth: 120},
	      {type: "block", inputWidth: "auto", offsetTop: 12, list: [
	           {type: "input",name: "eUser", label: "Login", value: "p_rossi"},
		   {type: "password",name: "ePassword", label: "Password", value: "123"},
		   //{type: "checkbox", label: "Remember me", checked: true},
		   {type: "button", value: "Login", offsetLeft: 70, offsetTop: 14}
		   ]}
		   ];
  dhxWins = new dhtmlXWindows();
  w1 = dhxWins.createWindow("w1", 10, 10, 300, 250);
  w1.denyResize();
  w1.centerOnScreen();
  myForm = w1.attachForm(formData, true);
  myForm.attachEvent("onButtonClick", function(id){
    AvammUser = myForm.getInput("eUser").value;
    AvammPasswd = myForm.getInput("ePassword").value;
    myForm.Hide;
    LoadTasks();
  });
}

function LoadTasks() {
  if (AvammUser) {
    dhx4.ajax.query
      ({
        type: "GET",
        url: "http://localhost:8085/task/list.json",
        dataType: "json",
        async: true,
        headers: {
                "Authorization": "Basic " + btoa(AvammUser + ":" + AvammPasswd)
                },
        success: function (data){
          document.getElementById("realForm").submit();
          gTasks.parse(data);
        }
      });
      //gTasks.load('http://localhost:8085/task/list.json');
  }
}
