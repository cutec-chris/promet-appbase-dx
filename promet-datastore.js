function newPrometDataStore(aName,aSheme) {
  var aDS = new dataProcessor(aName);
  aDS.TableName = aName;
  if (aSheme) {
    aDS.data.sheme(aSheme);
  }
  aDS.setTransactionMode("REST",false);
  aDS.enablePartialDataSend(true);
  aDS.attachEvent("onBeforeDataSending", function(id, mode, data){
    //here you can place your own data saving logic
    console.log(aDS.TableName,'data should be send ',id,mode,data);
    return false;
  });
  aDS.attachEvent("onAfterUpdateFinish",function(){
     alert(aDS.TableName,"single row updated")
  });
  aDS.attachEvent("onFullSync",function(){
     alert(aDS.TableName,"all rows updated")
  });
  return aDS;
}
