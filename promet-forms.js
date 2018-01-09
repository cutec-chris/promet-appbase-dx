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
  aForm.Id = aId;
  aForm.LoadData = function(Callback) {
    var aURL = '/'+aForm.TableName+'/by-id/'+aForm.Id+'/item.json';
    aForm.loading = true;
    if (LoadData(aURL,function(aData){
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

  a.attachToolbar({
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
  if (aList.OnCreateForm) {
    aList.OnCreateForm(aForm);
  }
  aForm.Tabs.setSizes();
  aForm.Layout.progressOn();
  try {
  aForm.LoadData(function(){
    aForm.Form.setItemValue("Shorttext",aForm.Data.Fields.name);
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
      console.log("Refresh "+aName);
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
    var newWindow=window.open(AvammServer,'_blank');
    if (newWindow==null) { //no rights to open an new window (possibly were running from file:// so we use an dhtmlx window)
      newWindow = wnMain.createWindow(aList.Grid.getSelectedRowId(),10,10,200,200);
      var newForm = newPrometForm(newWindow,aName,aList.Grid.getSelectedRowId(),aList);
    } else {
      newWindow.document.querySelector('head').innerHTML += '<script src="https://cdn.dhtmlx.com/edge/dhtmlx.js" type="text/javascript"></script><script src="appbase/promet.js" type="text/javascript"></script><script src="appbase/promet-datastore.js" type="text/javascript"></script><script src="appbase/promet-forms.js" type="text/javascript"></script><link rel="stylesheet" type="text/css" href="https://cdn.dhtmlx.com/edge/fonts/font_awesome/css/font-awesome.min.css"/><link rel="stylesheet" type="text/css" href="https://cdn.dhtmlx.com/edge/dhtmlx.css"><style>html, body {width: 100%;height: 100%;overflow: hidden;margin: 0px;background-color: #EBEBEB;}</style>';
      window.setTimeout(function(){
        var newForm = newPrometForm(newWindow.document.body,aName,aList.Grid.getSelectedRowId(),aList);
      },150);
    }
  });
  return aList;
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
