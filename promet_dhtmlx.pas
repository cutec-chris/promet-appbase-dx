unit promet_dhtmlx;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, promet_base, dhtmlx_form;

implementation

function DHTMLXoginForm : Boolean;
var
  LoginForm : TDHTMLXForm;
  Formdata : TJSObject;
  LoginFormCont: TJSHTMLElement;
begin
  asm
    FormData = [
    {type: "settings", position: "label-left", labelWidth: 75, inputWidth: 150},
    {type: "block", blockOffset: 30, offsetTop: 15, width: "auto", list: [
        {type: "label", label: "Please introduce yourself", labelWidth: "auto", offsetLeft: 35},
        {type: "input", label: "Login", name: "dhxform_demo_login", value: "", offsetTop: 20},
        {type: "password", label: "Password", name: "dhxform_demo_pwd", value: ""},
        {type: "button", name: "submit", value: "Let me in", offsetTop: 20, offsetLeft: 72}
    ]}
    ];
  end;
  LoginFormCont:=TJSHTMLElement(Document.createElement('div'));
  window.document.body.appendChild(LoginFormCont);
  LoginFormCont.style.cssText:='position: absolute;z-index: 100; top: 50%; left: 50%; margin-top: -50px; margin-left: -50px; width: 200px; height: 200px;';
  LoginForm := TDHTMLXForm.New(LoginFormCont,FormData);
end;

initialization
  promet_base.OnLoginForm:=@DHTMLXoginForm;
end.

