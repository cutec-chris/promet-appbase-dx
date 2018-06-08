unit promet_dhtmlx;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, promet_base, dhtmlx_form, dhtmlx_windows;

resourcestring
  strLoginText = 'Anmeldung';
  strLogin = 'Login';
  strPassword = 'Passwort';
  strSaveLogin = 'Anmeldedaten speichern';

implementation

function DHTMLXoginForm : Boolean;
var
  LoginForm : TDHTMLXForm;
  Formdata : TJSObject;
  LoginFormCont: TJSHTMLElement;
  aWin: TDHTMLXWindowsCell;
begin
  if dhtmlx_windows.Windows.window('LoginFormWindow') = null then
    begin
      dhtmlx_windows.Windows.createWindow('LoginFormWindow',document.body.clientWidth div 2-200,document.body.clientHeight div 2-100,400,210);
      aWin := dhtmlx_windows.Windows.window('LoginFormWindow');
      aWin.setText(strLoginText);
      LoginForm := TDHTMLXForm(aWin.attachForm(FormData));
      LoginForm.addItem(null,new(['type','block',
                                  'width','auto',
                                  'name','LoginBlock']));
      LoginForm.addItem('LoginBlock',new(['type','input',
                                          'label', strLogin,
                                          'name','eUsername']));
      LoginForm.addItem('LoginBlock',new(['type','input',
                                          'label', strPassword,
                                          'name','ePassword']));
      LoginForm.addItem('LoginBlock',new(['type','checkbox',
                                          'label', strSaveLogin,
                                          'name','cbSaveLogin']));
      LoginForm.addItem('LoginBlock',new(['type','button',
                                          'value', strLogin,
                                          'name','eSubmit']));
      LoginForm.setItemFocus('eUsername');
    end;
end;

initialization
  promet_base.OnLoginForm:=@DHTMLXoginForm;
end.

