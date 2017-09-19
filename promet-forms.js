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
  return aList;
}

/*
  PrometForm:
    consists of an Toolbar and Tabs
  Toolbar
  Tabs
  onCreate
*/

function newPrometForm(aName,aId) {
  var aForm = {};
  aForm.TableName = aName;
  aForm.Id = aId;
  return aForm;
}

function newPrometAutoComplete(aPopupParams,aTable,aRow,aHeader,aColIDs,aDblClick) {
  var aPopup = {};
  var Popup;
  var Grid;
  aPopup.Popup = new dhtmlXPopup({ form: fRMA, id: ["eProduct"] });
  var ppId = aPopup.Popup.attachEvent("onShow",function(){
 		 aPopup.Grid = aPopup.Popup.attachGrid(300,200);
  				aPopup.Grid.setImagePath("../../../codebase/imgs/")
          aPopup.Grid.setHeader(aHeader);
          aPopup.Grid.setColumnIds(aColIDs);
          aPopup.DataSource = newPrometDataStore(aTable);
          aPopup.DataSource.FillGrid(aPopup.Grid,'',0,function (){
  					aPopup.Grid.selectRow(0);
  					aPopup.Grid._loaded = true;
  				});
  				aPopup.Grid.attachEvent("onRowDblClicked",aDblClick);
  				aPopup.Popup.detachEvent(ppId);
          aPopup.Grid.init();
	});
  return aPopup;
}
