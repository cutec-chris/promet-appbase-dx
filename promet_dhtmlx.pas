unit promet_dhtmlx;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, Avamm, dhtmlx_form, dhtmlx_windows;

resourcestring
  strLoginText = 'Anmeldung';
  strLogin = 'Login';
  strPassword = 'Passwort';
  strSaveLogin = 'Anmeldedaten speichern';
  strUserAbort = 'Benutzerabbruch';

implementation

function DHTMLXoginForm : TJSPromise;
var
  LoginForm : TDHTMLXForm;
  Formdata : TJSObject;
  LoginFormCont: TJSHTMLElement;
  aWin: TDHTMLXWindowsCell;
  isResolved : Boolean = false;

  procedure IntDoLoginForm(resolve, reject: TJSPromiseResolver);
    procedure AfterValidate(status : Boolean);
    begin
      if status then
        begin
          Avamm.AvammLogin:=window.btoa(LoginForm.getItemValue('eUsername')+':'+LoginForm.getItemValue('ePassword'));
          resolve(true);
          if LoginForm.getItemValue('cbSaveLogin') = 'Y' then
            Avamm.setCookie('login',Avamm.AvammLogin);
          isResolved:=True;
          aWin.close;
        end;
    end;
    procedure eSubmitClick;
    begin
      LoginForm.validate;
    end;
    function CloseWindow : Boolean;
    begin
      if not isResolved then
        begin
          reject(strUserAbort);
          asm
            window.dispatchEvent(pas.Avamm.ConnectionErrorEvent);
          end;
        end;
      result := True;
    end;
  begin
    Avamm.AvammLogin:=Avamm.getCookie('login');
    if Avamm.AvammLogin <> '' then
      begin
        resolve(true);
        exit;
      end;
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
                                            'name','eUsername',
                                            'required',true]));
        LoginForm.addItem('LoginBlock',new(['type','password',
                                            'label', strPassword,
                                            'name','ePassword']));
        LoginForm.addItem('LoginBlock',new(['type','checkbox',
                                            'label', strSaveLogin,
                                            'name','cbSaveLogin']));
        LoginForm.addItem('LoginBlock',new(['type','button',
                                            'value', strLogin,
                                            'name','eSubmit']));
        LoginForm.setItemFocus('eUsername');
        LoginForm.attachEvent('onEnter',@eSubmitClick);
        LoginForm.enableLiveValidation(true);
        LoginForm.attachEvent('onButtonClick',@eSubmitClick);
        aWin.attachEvent('onClose',@CloseWindow);
        LoginForm.attachEvent('onAfterValidate',@AfterValidate);
      end
    else
      begin
        aWin := dhtmlx_windows.Windows.window('LoginFormWindow');
      end;

  end;

begin
  Result := TJSPromise.new(@IntDoLoginForm);
end;

initialization
  Avamm.OnLoginForm:=@DHTMLXoginForm;
end.

