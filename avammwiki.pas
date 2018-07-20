unit AvammWiki;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, js, web, Types, dhtmlx_layout, dhtmlx_base, Avamm;

var
  Layout : TDHTMLXLayout = nil;
  Content : TJSHTMLElement;

procedure ShowStartpage;
procedure Refresh;
procedure FixWikiContent(elem : TJSHTMLElement;aForm : JSValue);

implementation

procedure Refresh;
  function FillWiki(aValue: TJSXMLHttpRequest): JSValue;
  begin
    Content.innerHTML:=aValue.responseText;
    FixWikiContent(Content,null);
    Layout.cells('a').progressOff;
  end;
var
  DataLoaded: TJSPromise;
begin
  LoadData('/wiki/'+string(UserOptions.Properties['startpage']))._then(TJSPromiseResolver(@FillWiki));
end;
procedure ShowStartpage;
  procedure HideElement(currentValue: TJSNode;
    currentIndex: NativeInt; list: TJSNodeList);
  begin
    TJSHTMLElement(currentValue).style.setProperty('display','none');
  end;
  function DoShowStartpage(aValue: JSValue): JSValue;
  var
    FParent: JSValue;
  begin
    if Layout = nil then
      begin
        FParent := Avamm.GetAvammContainer();
        Layout := TDHTMLXLayout.New(js.new(['parent',FParent,'pattern','1C']));
        Layout.cells('a').hideHeader;
        Content := TJSHTMLElement(document.createElement('div'));
        Layout.cells('a').appendObject(Content);
      end;
    TJSHTMLElement(Avamm.GetAvammContainer()).childNodes.forEach(@HideElement);
    Layout.cont.style.setProperty('display','block');
    Layout.cells('a').progressOn;
  end;
begin
  WidgetsetLoaded._then(@DoShowStartpage);
  Refresh;
end;
procedure FixWikiContent(elem : TJSHTMLElement;aForm : JSValue);
var
  anchors, images: TJSHTMLCollection;
  oldLink, aTable, aId, aParams, aHref: string;
  i, a: Integer;
  jtmp: TJSString;
  aParam: TStringDynArray;
begin
  try
    asm
      if (elem.style.fontFamily!="Arial") {
        elem.style.fontFamily = "Arial";
        elem.style.fontSizeAdjust = 0.5;
      }
    end;
  except
  end;
  images := elem.getElementsByTagName('img');
  for i := 0 to images.length-1 do
    begin
      try
        aHref := TJSHTMLElement(images[i]).getAttribute('src');
        aHref:=copy(aHref,pos('(',aHref)+1,length(aHref));
        aHref:=copy(aHref,0,pos(')',aHref)-1);
        aHref:='/icons/'+aHref+'.png';
        TJSHTMLElement(images[i]).setAttribute('src',aHref);
      except
      end;
    end;
  anchors := elem.getElementsByTagName('a');
  for i := 0 to anchors.length-1 do
    begin
      try
        asm
          aHref = anchors[i].href;
        end;
        if (pos('@',aHref)>0)
        and ((copy(aHref,0,4)='http') or (copy(aHref,0,4)='file'))
        then
          begin
            asm
              oldLink = decodeURI(anchors[i].href.substring(anchors[i].href.lastIndexOf('/')+1));
              aTable = oldLink.substring(0,oldLink.indexOf('@')).toLowerCase();
            end;
            if pos('{',oldLink)>0 then
              aId := copy(oldLink,0,pos('{',oldLink)-1)
            else
              aId := oldLink;
            aId := copy(aId,pos('@',aId)+1,length(aId));
            if pos('(',aId)>0 then
              begin
                aParams:=copy(aId,pos('(',aId)+1,length(aId));
                aParams:=copy(aParams,0,pos(')',aParams)-1);
                jtmp := TJSString.New(aParams);
                aParam := jtmp.split(',');
                aId := copy(aId,0,pos('(',aId)-1);
                aParams:='';
                for a := 0 to length(aParam)-1 do
                  aParams:=aParams+aParam[a]+'&';
                aParams:=copy(aParams,0,length(aParams)-1);
              end;
            if aForm<>null then
              begin
                aParams:=StringReplace(aParams,'@VARIABLES.ID@',string(TJSObject(aForm).Properties['BaseId']),[rfReplaceAll]);
                aParams:=StringReplace(aParams,'@VARIABLES.SQL_ID@',string(TJSObject(aForm).Properties['Id']),[rfReplaceAll]);
              end;
            if (aParams <> '') then
              TJSHTMLElement(anchors[i]).setAttribute('href','#' + aTable + '/by-id/'+aId+'/'+aParams)
            else
              TJSHTMLElement(anchors[i]).setAttribute('href','#' + aTable + '/by-id/'+aId+'/');
            TJSHTMLElement(anchors[i]).setAttribute('AvammTable',aTable);
            TJSHTMLElement(anchors[i]).setAttribute('AvammId',aId);
            TJSHTMLElement(anchors[i]).setAttribute('AvammParams',aParams);
          end;
      except
      end;
    end;
end;
end.

