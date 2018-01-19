/*
  PrometForm:
    consists of an Toolbar and Tabs
  Toolbar
  Tabs
  onCreate
*/
function newPrometForm(aParent,aName,aId,aList) {
  var aForm = {};
  aForm.TableName = aName;
  aForm.Parent = aParent;
  aForm.Id = aId;
  aForm.LoadData = function(Callback) {
    var aURL = '/'+aForm.TableName+'/by-id/'+aForm.Id+'/item.json';
    aForm.loading = true;
    if (window.LoadData(aURL,function(aData){
      console.log("Data loaded");
      try {
        if ((aData)&&(aData.xmlDoc))
        var aData2;
        var aID;
        if (aData.xmlDoc.responseText != '')
          aData2 = JSON.parse(aData.xmlDoc.responseText);
        if (aData2) {
          aForm.Data = aData2;
        }
      aForm.loading = false;
      } catch(err) {
        aForm.loading = false;
        console.log(aForm.TableName,'failed to load data !',err);
      }
      if (Callback)
        Callback();
    })==true) {
      console.log("Data loading...");
    }
    else {
      if (Callback)
        Callback();
      dhtmlx.message({
        type : "error",
        text: "Login erforderlich",
        expire: 3000
      });
    }
  }

  aForm.Layout = new dhtmlXLayoutObject(aParent, '2E');
  var a = aForm.Layout.cells('a');
  a.setHeight('90');
  a.hideHeader();
  a.fixSize(0,1);
	var b = aForm.Layout.cells('b');
	b.hideHeader();

  aForm.Toolbar = a.attachToolbar({
      items:[
        {id: "save", type: "button", text: "Speichern", img: "fa fa-save"},
        {id: "abort", type: "button", text: "Abbrechen", img: "fa fa-cancel"},
      ],
    iconset: "awesome"
  });
  var formStructure =
  [
    {type: "input", label: "Nummer", value: "", name: "Id", readonly:"true", hidden: "true", inputWidth: "100", note: { text: "Die Nummer des Eintrages", width:300 }, tooltip:"geben Sie hier die Id ein."},
    {type:"newcolumn"},
  	{type: "input", label: "Kurztext", value: "", name: "Shorttext", inputWidth: "400", note: { text: "Der Kurztext des Eintrages", width:300 }, tooltip:"geben Sie hier den Kurztext ein."},
  ];
  aForm.Form =  a.attachForm(formStructure);
  aForm.Tabs = b.attachTabbar({
      mode:               "top",          // string, optional, top or bottom tabs mode
      align:              "left",         // string, optional, left or right tabs align
      close_button:       true,           // boolean, opt., render Close button on tabs
      content_zone:       true,           // boolean, opt., enable/disable content zone
      arrows_mode:        "auto"          // mode of showing tabs arrows (auto, always)
  });
  if ((aList) && (aList.OnCreateForm)) {
    aList.OnCreateForm(aForm);
  }
  aForm.Tabs.setSizes();
  //Load Base Data for Item
  aForm.Layout.progressOn();
  try {
  aForm.LoadData(function(){
    if (aForm.Data.Fields.name)
      aForm.Form.setItemValue("Shorttext",aForm.Data.Fields.name)
    else if (aForm.Data.Fields.shorttext)
      aForm.Form.setItemValue("Shorttext",aForm.Data.Fields.shorttext)
    else if (aForm.Data.Fields.subject)
      aForm.Form.setItemValue("Shorttext",aForm.Data.Fields.subject);
    try {
      aForm.Parent.parentElement.ownerDocument.title=aForm.Form.getItemValue("Shorttext");
    } catch(err) {s}
    if (aForm.Data.Fields.id==null) {
      aForm.Form.hideItem("Id");
    } else {
      aForm.Form.setItemValue("Id",aForm.Data.Fields.id);
      aForm.Form.showItem("Id");
    }
    if (aForm.OnDataUpdated) {
      aForm.OnDataUpdated(aForm);
    }
    aForm.Layout.progressOff();
  });
  } catch(err) {
    console.log('Loading Exception:'+err.message);
    aForm.Layout.progressOff();
  }
  //Load HTML Form List (Directory Contents)
  try {
    var bURL = '/'+aForm.TableName+'/by-id/'+aForm.Id+'/.json';
    if (window.LoadData(bURL,function(aData){
      console.log("Directory contents loaded");
      try {
        if ((aData)&&(aData.xmlDoc))
        var aData2;
        var aID;
        if (aData.xmlDoc.responseText != '')
          aData2 = JSON.parse(aData.xmlDoc.responseText);
        aForm.Tabs.attachEvent("onContentLoaded", function(id){
          aForm.Tabs.forEachTab(function(tab){
            var aFrame = tab.getFrame();
            FixWikiContents(aFrame);
            tab.progressOff();
          });
        });
        if (aData2) {
          //first add (and load) overview
          for (var i = 0; i < aData2.length; i++) {
            var aName = aData2[i].name.split('.')[0];
            var aCaption = aName;
            if (aCaption == 'overview') {
              aCaption = 'Übersicht';
              if (aData2[i].name.split('.')[aData2[i].name.split('.').length - 1] == 'html') {
                aForm.Tabs.addTab(
                aName,    // id
                aCaption,    // tab text
                null,       // auto width
                null,       // last position
                false,      // inactive
                true);
                aForm.Tabs.tabs(aName).attachURL(GetBaseUrl()+'/'+aForm.TableName+'/by-id/'+aForm.Id+'/'+aData2[i].name);
                aForm.Tabs.tabs(aName).progressOn();
              }
            }
          }
          //then add all other frames
          for (var i = 0; i < aData2.length; i++) {
            var aName = aData2[i].name.split('.')[0];
            var aCaption = aName;
            if (aCaption != 'overview') {
              if (aData2[i].name.split('.')[aData2[i].name.split('.').length - 1] == 'html') {
                aForm.Tabs.addTab(
                aName,    // id
                aCaption,    // tab text
                null,       // auto width
                null,       // last position
                false,      // inactive
                true);
                aForm.Tabs.tabs(aName).attachURL(GetBaseUrl()+'/'+aForm.TableName+'/by-id/'+aForm.Id+'/'+aData2[i].name);
                aForm.Tabs.tabs(aName).progressOn();
              }
            }
          }
          aForm.Tabs.moveTab("overview", 0);
          try {
            aForm.Tabs.tabs("overview").setActive();
          } catch(err) {}
        }
      } catch(err) {
        console.log(aForm.TableName,'failed to load Directory data !',err);
      }
    })==true) {
      console.log("Data loading...");
    }
    else {
      //no login ??
    }
  } catch(err) {
    console.log('Loading Exception:'+err.message);
  }

  return aForm;
}

/*
  PrometList:
    consists of an Toolbar and Grid
  Toolbar
  Grid
  TableName
  DataSource
  onCreate
*/

function newPrometList(aName,aText) {
  var aList = {};
  var DataSource;
  var Grid;
  var Page;
  var Toolbar;
  var OldFilter;
  aList.TableName = aName;
  function RefreshList() {
    aList.Page.progressOn();
    try {
      //console.log("Refresh "+aName);
      aList.DataSource.FillGrid(aList.Grid,OldFilter,0,function (){
        aList.Page.progressOff();
      });
    } catch(err) {
      console.log('Refresh Exception:'+err.message);
      aList.Page.progressOff();
    }
  }
  console.log("Loading "+aName+" Page...");
  sbMain.addItem({id: 'si'+aName, text: aText});
  aList.Page = window.parent.sbMain.cells('si'+aName);
  aList.Toolbar = aList.Page.attachToolbar({
      parent:"pToolbar",
        items:[
          {id: "refresh", type: "button", text: "Aktualisieren", img: "fa fa-refresh"}
        ],
      iconset: "awesome"
  });
  aList.Toolbar.attachEvent("onClick", function(id) {
    if (id=='new') {
    } else if (id=='refresh') {
      RefreshList();
    }
  });
  aList.Grid = aList.Page.attachGrid({parent:"pTimes"});
  aList.Grid.setImagePath("codebase/imgs/");
  aList.Grid.setSizes();
  aList.Grid.enableAlterCss("even","uneven");
  aList.Grid.setEditable(false);
  aList.Grid.attachEvent("onFilterStart", function(indexes,values){
    OldFilter = '';
    for (var i = 0; i < indexes.length; i++) {
      if (values[i]!='')
        OldFilter += ' AND lower("'+aList.Grid.getColumnId(indexes[i])+'")'+' like lower(\'%'+values[i]+'%\')';
    }
    OldFilter = OldFilter.substring(5,OldFilter.length);
    aList.Page.progressOn();
    try {
      aList.DataSource.FillGrid(aList.Grid,OldFilter,0,function (){
        aList.Page.progressOff();
      });
    } catch(err) {
      aList.Page.progressOff();
    }
  });
  aList.Grid.init();
  aList.DataSource = newPrometDataStore(aName);
  aList.DataSource.DataProcessor.init(aList.Grid);
  window.parent.sbMain.attachEvent("onSelect", function(id, lastId){
    if (id == 'si'+aName) {
      RefreshList();
    }
  });
  aList.Grid.attachEvent("onRowDblClicked",function(){
    OpenElement(aName,aList.Grid.getSelectedRowId(),aList);
  });
  window.AvammLists.push(aList);
  return aList;
}

function OpenElement(aTable,aId,aList) {
  if (aList == null) {
    for (var i = 0; i < window.AvammLists.length; i++) {
      if (AvammLists[i].TableName == aTable) {
        aList = AvammLists[i];
      }
    }
  }
  var newWindow=window.open('','_blank');
  if (newWindow==null) { //no rights to open an new window (possibly were running from file:// so we use an dhtmlx window)
    newWindow = wnMain.createWindow(aId,10,10,200,200);
    var newForm = newPrometForm(newWindow,aTable,aId,aList);
  } else {
    parent.RegisterWindow(newWindow);
    var newPath = '';
    var pathArray = window.location.pathname.split( '/' );
    for (i = 0; i < pathArray.length-1; i++) {
      newPath += "/";
      newPath += pathArray[i];
    }
    newWindow.location.href=window.location.protocol + "//" + window.location.host + newPath+'obj.html';
    newWindow.onload = function () {
      console.log('Dokument geladen');
      newWindow.location.href=newWindow.location.href+'#'+aTable+'/by-id/'+aId;
      newWindow.List = aList;
    }
  }
}

function newPrometAutoComplete(aPopupParams,aTable,aRow,aHeader,aColIDs,Filter,aDblClick) {
  var aPopup = {};
  var Popup;
  var Grid;
  aPopup.DoFilter = function(aFilter) {
    if (!aPopup.DataSource.loading) {
        aPopup.Grid.filterBy(1,aFilter);
				if (aPopup.Grid.getRowsNum()==0) {
					aPopup.DataSource.FillGrid(aPopup.Grid,Filter.replace('FILTERVALUE',aFilter),0,function (){
						if (aPopup.Grid.getRowsNum()>0) {
						  if (!aPopup.Popup.isVisible()) aPopup.Popup.show("eProduct");
  					  aPopup.Grid.selectRow(0);
					  }
  				});
				}
    }

  }
  aPopup.Popup = new dhtmlXPopup(aPopupParams);
  aPopup.DataSource = newPrometDataStore(aTable);
  aPopup.Grid = aPopup.Popup.attachGrid(300,200);
  aPopup.Grid.setImagePath("../../../codebase/imgs/")
  aPopup.Grid.setHeader(aHeader);
  aPopup.Grid.setColumnIds(aColIDs);
  aPopup.DataSource.DataProcessor.init(aPopup.Grid);
  aPopup.Grid.init();
  var ppId = aPopup.Popup.attachEvent("onShow",function(){
    aPopup.Grid.attachEvent("onRowDblClicked",aDblClick);
    aPopup.Popup.detachEvent(ppId);
	});
  return aPopup;
}

function RegisterWindow(aWindow) {
  function router () {
      console.log('Routing to:'+aWindow.location.hash);
      // Lazy load view element:
      var route = aWindow.location.hash.split('/');
      if (route[1]=='by-id') {
        aWindow.document.body.innerHTML = '';
        aWindow.Form = newPrometForm(aWindow.document.body,route[0].substr(1,route[0].length),route[2],aWindow.List);
      }
  }
  // Listen on hash change:
  aWindow.addEventListener('hashchange', router);
  // Listen on page load:
  aWindow.addEventListener('load', router);
}

function FixWikiContents(aFrame) {
  try {
    if (aFrame.contentDocument.body.style.fontFamily!="Arial") {
      aFrame.contentDocument.body.style.fontFamily = "Arial";
      aFrame.contentDocument.body.style.fontSizeAdjust = 0.5;
      var anchors = aFrame.contentDocument.getElementsByTagName("a");
      for (var i = 0; i < anchors.length; i++) {
        if ((anchors[i].href.indexOf('@')>0)&&(anchors[i].href.substring(0,4)=='http')) {
          var oldLink = decodeURI(anchors[i].href.substring(anchors[i].href.lastIndexOf('/')+1));
          var aTable = oldLink.substring(0,oldLink.indexOf('@')).toLowerCase();
          oldLink = oldLink.substring(oldLink.indexOf('@')+1);
          var aId;
          if (oldLink.indexOf('{')>0) {
            aId = oldLink.substring(0,oldLink.indexOf('{'))
          } else {
            aId = oldLink;
          }
          if (aId.indexOf('(')>0) {
            var aParams = aId.substring(aId.indexOf('(')+1,aId.length);
            aParams = aParams.substring(0,aId.indexOf(')')-1);
            var aParam = aParams.split(',');
            aId = aId.substring(0,aId.indexOf('('))
            aParams = '';
            for (var a = 0; a < aParam.length; a++) {
              aParams += aParam[a];
              if (a > 0)
                aParams += '&';
            }
            aParams = aParams.substring(0,aParams.length-1);
          }
          anchors[i].href = "/obj.html#" + aTable + '/by-id/'+aId;
          if (aParams != '')
            anchors[i].href += '?'+aParams;
          anchors[i].AvammTable = aTable;
          anchors[i].AvammId = aId;
          anchors[i].onclick = function() {
             OpenElement(this.AvammTable,this.AvammId);
             return false;
          }
        }
      }
    }
  } catch(err) {}
}
