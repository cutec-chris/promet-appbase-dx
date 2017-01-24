function newPrometDataStore(aName,aSheme) {
  var aDS = {};
  aDS.DataProcessor = new dataProcessor(aName);
  aDS.TableName = aName;
  if (aSheme) {
    aDS.data.sheme(aSheme);
  }
  aDS.DataProcessor.setTransactionMode("REST",false);
  aDS.DataProcessor.enablePartialDataSend(true);
  aDS.DataProcessor.attachEvent("onBeforeDataSending", function(id, mode, data){
    //here you can place your own data saving logic
    console.log(aDS.TableName,'data should be send ',id,mode,data);
    return false;
  });
  aDS.DataProcessor.attachEvent("onAfterUpdateFinish",function(){
     alert(aDS.TableName,"single row updated")
  });
  aDS.DataProcessor.attachEvent("onFullSync",function(){
     alert(aDS.TableName,"all rows updated")
  });
  aDS.FillGrid = function(aGrid) {
    if (LoadData('/'+aDS.TableName+'/list.json',function(aData){
      console.log("Data loaded");
      aGrid.clearAll();
      var aData2 = JSON.parse(aData.xmlDoc.response);
      for (var i = 0; i < aData2.length-1; i++) {
        var aRow = "";
        for (var a = 0; a < aGrid.getColumnsNum()-1;a++)
          aRow += ','+aData2[i][aGrid.getColumnId(a)];
        aRow = aRow.substring(1,aRow.length);
        aGrid.addRow(aData2[i].id,aRow);
      }
    })==true) {
      console.log("Data loaded 2");
    }
    else {
      dhtmlx.message({
        type : "error",
        text: "Login erforderlich",
        expire: 3000
      });
    }
  }
  return aDS;
}
