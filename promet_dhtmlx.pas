unit promet_dhtmlx;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, promet_base, dhtmlx_form, dhtmlx_windows;

implementation

function DHTMLXoginForm : Boolean;
var
  LoginForm : TDHTMLXForm;
  Formdata : TJSObject;
  LoginFormCont: TJSHTMLElement;
  aWin: TDHTMLXWindowsCell;
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
  if dhtmlx_windows.Windows.window('LoginFormWindow') = null then
    begin
      dhtmlx_windows.Windows.createWindow('LoginFormWindow',document.body.clientWidth div 2-200,document.body.clientHeight div 2-100,400,200);
      aWin := dhtmlx_windows.Windows.window('LoginFormWindow');
      LoginForm := TDHTMLXForm(aWin.attachForm(FormData));
      LoginForm.addItem(null,new(['type','block',
                                  'width','auto',
                                  'name','LoginBlock']));
      LoginForm.addItem('LoginBlock',new(['type','label',
                                          'label','Anmeldung']));
      LoginForm.addItem('LoginBlock',new(['type','input',
                                          'label','Login',
                                          'name','eUsername']));
      LoginForm.addItem('LoginBlock',new(['type','input',
                                          'label','Passwort',
                                          'name','ePassword']));
      LoginForm.addItem('LoginBlock',new(['type','checkbox',
                                          'label','Anmeldedaten speichern',
                                          'name','cbSaveLogin']));
      LoginForm.addItem('LoginBlock',new(['type','button',
                                          'value','Login',
                                          'name','eSubmit']));
    end;
end;

initialization
  promet_base.OnLoginForm:=@DHTMLXoginForm;
end.

