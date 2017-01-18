function newPrometDataStore(aName,aSheme) {
  var aDS = new dhtmlXDataStore();
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
  return aDS;
}
