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
  aList.TableName = aName;
  function RefreshList() {
    aList.Page.progressOn();
    try {
      console.log("Refresh "+aName);
      aList.DataSource.FillGrid(aList.Grid,'',0,function (){
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
  aList.Grid.filterByAll=function(){
  };
  aList.Grid.attachEvent("onFilterStart", function(indexes,values){
    var aFilter = '';
    for (var i = 0; i < indexes.length; i++) {
      if (values[i]!='')
        aFilter += ' AND "'+aList.Grid.getColumnId(indexes[i])+'"'+' like \'%'+values[i]+'%\'';
    }
    aFilter = aFilter.substring(5,aFilter.length);
    aList.Page.progressOn();
    try {
      aList.DataSource.FillGrid(aList.Grid,aFilter,0,function (){
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
