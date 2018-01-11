var sbMain;
var wnMain;
var lMain;
var AvammLogin;
var AvammServer = '';

function RegisterAvammAppPage(caption,name,src) {
  sbMain.addItem({id: 'si'+name, text: caption, AppID: name, AppSrc: src, icon: ''});
  sbMain.cells('si'+name).attachURL(src, null, false);
}

function InitAvammApp(AppParent){
  window.dhx4.skin = 'material';
  if (!AppParent)
    AppParent = document.body;
  sbMain =  new dhtmlXSideBar(
    { parent: AppParent,
      //template: 'myview',
      template: 'text',
      width: '200',
      iconset: "awesome",
      header: (window.innerWidth<495)|(window.innerHeight<495),
      autohide: (window.innerWidth<495)|(window.innerHeight<495),
      offsets: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });
    dhtmlXSideBar.prototype.templates.myview =
    "<i class='#icon#'></i>"+
    "<div class='line'>#text#</div>";
/*
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
*/
  sbMain.attachEvent("onBeforeSelect", function(id, lastId){
    //TODO:attatchURL before Load and not on Load of the page
    //console.log("onBeforeSelect",id,sbMain.cells(id));
    //sbMain.cells(id).attachURL(sbMain.cells(id).AppSrc);
		return true;
	});
  sbMain.attachEvent("onSelect", function(id, lastId){
    //TODO:call Select handler
  });
  if (!AvammLogin) {
    RegisterAvammAppPage('Login','login','appbase/login.html');
    sbMain.cells('silogin').setActive();
  } else {
    sbMain.showSide();
  }
  eXcell_ch.prototype.setValue = function(val) {
     this.cell.style.verticalAlign="middle";
     if ((val=="Y")||(val==1)){
        val="Y";
        this.cell.chstate="1";
     } else {
        val="N";
        this.cell.chstate="0";
     }
     var obj = this;
     this.cell.setAttribute("excell", "ch");
     if (val=="Y")
        state=1
     else
        state=0
     this.setCValue("<img src='"+this.grid.imgURL+"item_chk"+state
        +".gif' onclick='new eXcell_ch(this.parentNode).changeState(true); (arguments[0]||event).cancelBubble=true; '>",
        this.cell.chstate);
  }
  eXcell_dhxCalendar.prototype.edit = function() {

         var arPos = this.grid.getPosition(this.cell);

         this.grid._grid_calendarA._show(false, false);
         var yPosition = 0;
         if(arPos[1] + this.grid._grid_calendarA.base.offsetHeight + this.cell.offsetHeight < window.innerHeight) {
            // Enough space to show dhxCalendar below date
            yPosition = arPos[1]+this.cell.offsetHeight;
         } else {
            // Show dhxCalendar above date
            yPosition = arPos[1]-(this.grid._grid_calendarA.base.offsetHeight);
         }
         var xPosition = arPos[0];
         if (xPosition+this.grid._grid_calendarA.base.clientWidth+ this.cell.offsetWidth>window.innerWidth) {
           xPosition = window.innerWidth-this.grid._grid_calendarA.base.clientWidth;
         }
         this.grid._grid_calendarA.setPosition(xPosition, yPosition);
         this.grid._grid_calendarA._last_operation_calendar = false;


         this.grid.callEvent("onCalendarShow", [this.grid._grid_calendarA, this.cell.parentNode.idd, this.cell._cellIndex]);
         this.cell._cediton = true;
         this.val = this.cell.val;
         this._val = this.cell.innerHTML;
         var t = this.grid._grid_calendarA.draw;
         this.grid._grid_calendarA.draw = function(){};
         this.grid._grid_calendarA.setDateFormat((this.grid._dtmask||"%d/%m/%Y"));
         this.grid._grid_calendarA.setDate(this.val||(new Date()));
         this.grid._grid_calendarA.draw = t;

         // Time is not needed so disable it
         this.grid._grid_calendarA.hideTime();
      }
  window.addEventListener('resize', function () {
    sbMain.setSizes();
  });
  wnMain = new dhtmlXWindows();
};

function StartAvammApp(){
  RegisterWindow(window);
};

function RegisterWindow(aWindow) {
  var el = null;
  function router () {
      // Lazy load view element:
      el = el || document.getElementById('view');
      // Current route url (getting rid of '#' in hash as well):
      var url = location.hash.slice(1) || '/';
      // Get route by url:
      var route = routes[url];
      // Do we have both a view and a route?
      if (el && route.controller) {
          // Render route template with John Resig's template engine:
          el.innerHTML = tmpl(route.templateId, new route.controller());
      }
  }
  // Listen on hash change:
  aWindow.addEventListener('hashchange', router);
  // Listen on page load:
  aWindow.addEventListener('load', router);
}

function GetBaseUrl(){
  if ((/^h/.test(document.location))&&(AvammServer == "")) {
  } else {
    AvammServer = 'http://localhost:8085';
  }
  if (AvammServer == "") {
    return 'http://localhost:8085';
  } else {
    return AvammServer;
  }
}

function LoadData(Url,Callback,IgnoreLogin) {
  dhx.ajax.timeout = 5000;
  var aTimeout = window.setTimeout(Callback,5000);
  dhx.ajax.query
      ({
        method: "GET",
        url: GetBaseUrl()+Url,
        dataType: "json",
        async: true,
        headers: {
                "Authorization": "Basic " + AvammLogin
                },
        callback: function (data){
          window.clearTimeout(aTimeout);
          if (Callback)
            Callback(data);
        }
      });
    return true;
}

function StoreData(Url,aData,Callback) {
    dhx.ajax.timeout = 5000;
    var aTimeout = window.setTimeout(Callback,5000);
    dhx.ajax.query
      ({
        method: "POST",
        url: AvammServer+Url,
        dataType: "json",
        async: false,
        data : aData,
        headers: {
                "Authorization": "Basic " + AvammLogin
                },
        callback: function (data){
          window.clearTimeout(aTimeout);
          if (Callback)
            Callback(data);
        }
      });
      return true;
}

function DoLogin(aLogin,aServer,Callback) {
  console.log("Login");
  var Data;
  AvammLogin=aLogin;
  AvammServer = aServer;
  LoadData("/data/login.xml",function(Data){ if (Callback) Callback(Data);});
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    if (!exdays) exdays = 5;
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    if (getCookie(cname)=='') console.log('failed to store Cookie');
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function parseDate(input, format) {
  format = format || 'dd.mm.yyyy'; // default format
  var parts = input.match(/(\d+)/g),
      i = 0, fmt = {};
  // extract date-part indexes from the format
  format.replace(/(yyyy|dd|mm)/g, function(part) { fmt[part] = i++; });

  return new Date(parts[fmt['yyyy']], parts[fmt['mm']]-1, parts[fmt['dd']]);
}

var formatDate = function(dt,format){
  format = format.replace('ss', pad(dt.getSeconds(),2));
  format = format.replace('s', dt.getSeconds());
  format = format.replace('dd', pad(dt.getDate(),2));
  format = format.replace('d', dt.getDate());
  format = format.replace('mm', pad(dt.getMinutes(),2));
  format = format.replace('m', dt.getMinutes());
  format = format.replace('MM', pad(dt.getMonth()+1,2));
  format = format.replace('M', dt.getMonth()+1);
  format = format.replace('yyyy', dt.getFullYear());
  format = format.replace('YYYY', dt.getFullYear());
  format = format.replace('yy', (dt.getFullYear()+"").substring(2));
  format = format.replace('YY', (dt.getFullYear()+"").substring(2));
  format = format.replace('HH', pad(dt.getHours(),2));
  format = format.replace('H', dt.getHours());
  return format;
}

pad = function(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}
