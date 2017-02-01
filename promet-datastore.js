function newPrometDataStore(aName,aSheme) {
  var aDS = {};
  aDS.DataProcessor = new dataProcessor(aName);
  aDS.TableName = aName;
  aDS.loading = false;
  if (aSheme) {
    aDS.data.sheme(aSheme);
  }
  aDS.DataProcessor.setTransactionMode("REST",false);
  aDS.DataProcessor.enablePartialDataSend(true);
  aDS.DataProcessor.attachEvent("onBeforeDataSending", function(id, mode, data){
    //here you can place your own data saving logic
    if (!aDS.loading) {
      console.log(aDS.TableName,'data should be send ',id,mode,data);
      var aRow = '';
      data.id = id;
      for(var propertyName in data) {
         if ((propertyName!='!nativeeditor_status')&&(propertyName!='gr_id'))
           aRow += ',"'+propertyName+'":"'+data[propertyName]+'"';
      }
      aRow = aRow.substring(1,aRow.length);
      aRow = '[{'+aRow+'}]';
      StoreData('/'+aDS.TableName+'/list.json',aRow,function(aData){
        if ((aData)&&(aData.xmlDoc)) {
          if (aData.xmlDoc.status == 200) {
            console.log("Data stored");
            aDS.DataProcessor.setUpdated(id);
          }
        }
      });
    }
    return false;
  });
  aDS.DataProcessor.attachEvent("onAfterUpdateFinish",function(){
     alert(aDS.TableName,"single row updated")
  });
  aDS.DataProcessor.attachEvent("onFullSync",function(){
     alert(aDS.TableName,"all rows updated")
  });
  aDS.FillGrid = function(aGrid,aFilter,aLimit) {
    var aURL = '/'+aDS.TableName+'/list.json';
    if (aFilter) {
      aURL+='?filter='+encodeURIComponent(aFilter);
    }
    if (LoadData(aURL,function(aData){
      aDS.loading = true;
      console.log("Data loaded");
      try {
        aGrid.clearAll();
        if ((aData)&&(aData.xmlDoc))
        var aData2 = JSON.parse(aData.xmlDoc.response);
        if (aData2) {
          for (var i = 0; i < aData2.length-1; i++) {
            var aRow = "";
            for (var a = 0; a < aGrid.getColumnsNum()-1;a++)
              aRow += ','+aData2[i][aGrid.getColumnId(a)];
            aRow = aRow.substring(1,aRow.length);
            aGrid.addRow(aData2[i].id,aRow);
            aDS.DataProcessor.setUpdated(aData2[i].id);
        }
      }
      aDS.loading = false;
      } catch(err) {
        aDS.loading = false;
        console.log(aDS.TableName,'failed to load data !',err);
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
