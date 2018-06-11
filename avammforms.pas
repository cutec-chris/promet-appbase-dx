unit AvammForms;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, dhtmlx_form, dhtmlx_toolbar,dhtmlx_grid,dhtmlx_layout;

type
  TAvammForm = class
  public
  end;

  { TAvammListForm }

  TAvammListForm = class
  public
    Page : TDHTMLXLayout;
    Toolbar : TDHTMLXToolbar;
    Grid : TDHTMLXGrid;
    constructor Create(aDataSet : string);
    procedure RefreshList;
  end;

implementation

{ TAvammListForm }

constructor TAvammListForm.Create(aDataSet: string);
begin
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
end;

procedure TAvammListForm.RefreshList;
begin
  try
    aList.Page.progressOn();
    //console.log("Refresh "+aName);
    aList.FillGrid(aList.Grid,OldFilter,0,function ()
    aList.Page.progressOff();
   except
     on e : Exception do

     console.log('Refresh Exception:'+err.message);
        aList.Page.progressOff();
  end;
end;

function newPrometAutoComplete(aPopupParams,aTable,aRow,aHeader,aColIDs,Filter,aDblClick) {
  var aPopup = {};
  var Popup;
  var Grid;
  aPopup.DoFilter = function(aFilter,DoSelect) {
    if (!aPopup.DataSource.loading) {
        aPopup.Grid.filterBy(1,aFilter);
				if (aPopup.Grid.getRowsNum()==0) {
					aPopup.DataSource.FillGrid(aPopup.Grid,Filter.replace('FILTERVALUE',aFilter),0,function (){
						if (aPopup.Grid.getRowsNum()>0) {
						  if (!aPopup.Popup.isVisible()) aPopup.Popup.show("eProduct");
              if (DoSelect)
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


function FixWikiContents(aFrame,aForm) {
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
          if (aForm) {
            aParams = aParams.replace('@VARIABLES.ID@',aForm.BaseId);
            aParams = aParams.replace('@VARIABLES.SQL_ID@',aForm.Id);
          }
          if (aParams != '')
            anchors[i].href = "/obj.html?"+aParams+"#" + aTable + '/by-id/'+aId
          else
            anchors[i].href = "/obj.html#" + aTable + '/by-id/'+aId;
          anchors[i].AvammTable = aTable;
          anchors[i].AvammId = aId;
          anchors[i].AvammParams = aParams;
          anchors[i].onclick = function() {
             OpenElement(this.AvammTable,this.AvammId,null,this.AvammParams);
             return false;
          }
        }
      }
    }
  } catch(err) {}
}
end.

