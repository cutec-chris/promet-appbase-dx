unit AvammWiki;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, js, web, dhtmlx_layout, dhtmlx_base, Avamm;

var
  Layout : TDHTMLXLayout = nil;
  Content : TJSHTMLElement;

procedure ShowStartpage;
procedure Refresh;

implementation

procedure Refresh;
  function FillWiki(aValue: TJSXMLHttpRequest): JSValue;
  begin
    Content.innerHTML:=aValue.responseText;
    FixWikiContent(Content,null);
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
  end;
begin
  WidgetsetLoaded._then(@DoShowStartpage);
  Refresh;
end;

end.

