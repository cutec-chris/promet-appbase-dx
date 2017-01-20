    function doOnFormInit() {
      fLogin.hideItem("logoutdata");
      fLogin.attachEvent("onButtonClick",function(buttonID){
        if(buttonID=="save"){
          if (fLogin.getItemValue("name")=="") {
                  dhtmlx.message({
                    type : "error",
  		              text: "Bitte Benutzer angeben",
		                expire: 5000
         	        });
          } else {
            DoLogin(fLogin.getItemValue("name"),fLogin.getItemValue("pass"),fLogin.getItemValue("server"),function(data){
              if (data) {
                if (data.xmlDoc.readyState == 4 && data.xmlDoc.status == 500) {
                  console.log('succesful login');
                  dhtmlx.message({
  	  	            text: "Login erfolgreich",
		                expire: 3000
           	      });
                  fLogin.hideItem("data");
                  fLogin.showItem("logoutdata");
                  document.getElementById("realForm").submit();
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
          AvammUser = "";
          AvammPasswd = "";
          console.log("logout, User cleared");
          dhtmlx.message({
            text: "Logout erfolgreich",
	          expire: 3000
          });
        }
      });
    }
