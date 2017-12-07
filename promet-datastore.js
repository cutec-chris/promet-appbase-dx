/*
  PrometDataStore:
  FillGrid(aGrid,aFilter,aLimit)
  DataProcessor
  onGetValue
  onSetValue
  TableName
  loading
*/

function newPrometDataStore(aName,aSheme) {
  var aDS = {};
  aDS.DataProcessor = new dataProcessor(aName);
  aDS.TableName = aName;
  aDS.loading = false;
  if (aSheme) {
    aDS.data.sheme(aSheme);
  }
  aDS.DataProcessor.setTransactionMode("REST",false);
//  aDS.DataProcessor.enablePartialDataSend(true);
//  aDS.DataProcessor.enableDebug(true);
  aDS.DataProcessor.enableDataNames(true);
  aDS.DataProcessor.attachEvent("onBeforeDataSending", function(id, mode, data){
    //here you can place your own data saving logic
    if (!aDS.loading) {
      console.log(aDS.TableName,'data should be send ',id,mode,data);
      var aRow = '';
      data.sql_id = id;
      for(var propertyName in data) {
        if (aDS.onSetValue)
          data[propertyName] = aDS.onSetValue(propertyName,data[propertyName]);
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
  aDS.FillGrid = function(aGrid,aFilter,aLimit,Callback) {
    var aURL = '/'+aDS.TableName+'/list.json';
    if (aFilter) {
      aURL+='?filter='+encodeURIComponent(aFilter);
    }
    if (aLimit) {
      aURL+='&limit='+aLimit;
    }
    aDS.loading = true;
    if (LoadData(aURL,function(aData){
      console.log("Data loaded");
      try {
        aGrid.clearAll();
        if ((aData)&&(aData.xmlDoc))
        var aData2;
        if (aData.xmlDoc.responseText != '')
          aData2 = JSON.parse(aData.xmlDoc.responseText);
        if (aData2) {
          for (var i = 0; i < aData2.length; i++) {
            var aRow = [];
            for (var a = 0; a < aGrid.getColumnsNum();a++) {
              if (aDS.onGetValue)
                aRow[a] = aDS.onGetValue(aGrid.getColumnId(a),aData2[i][aGrid.getColumnId(a)])
              else
                aRow[a] = aData2[i][aGrid.getColumnId(a)];
            }
            aGrid.addRow(aData2[i].sql_id,aRow);
            try {
              aDS.DataProcessor.setUpdated(aData2[i].sql_id);
            } catch(err) {}
          }
        }
      aDS.loading = false;
      } catch(err) {
        aDS.loading = false;
        console.log(aDS.TableName,'failed to load data !',err);
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
  return aDS;
}
