unit dhtmlx_layout;

{$mode objfpc}
{$modeswitch externalclass}

interface

uses
  js,web,dhtmlx_base;

type

  TDHTMLXLayoutCell = class external name 'dhtmlXLayoutCell' (TJSElement)
  end;

  TDHTMLXLayout = class external name 'dhtmlXLayoutObject' (TJSElement)
    constructor New(Pattern : JSValue);varargs;
    //attachEvent	adds any user-defined handler to available events
    //attachFooter	attaches footer to component's bottom
    //attachHeader	attaches header to component's top
    //attachMenu	attaches dhtmlxMenu to component's top
    //attachRibbon	attaches dhtmlxRibbon to component's top
    //attachStatusBar	attaches a status bar object to component's bottom
    //attachToolbar	attaches dhtmlxToolbar to component's top
    function cells(name : string) : TDHTMLXLayoutCell;                          //returns the cell object by the id
    //detachEvent	detaches a handler from an event
    //detachFooter	detaches footer from component's bottom
    //detachHeader	detaches header from component's top
    //detachMenu	detaches dhtmlxMenu from component's top
    //detachRibbon	detaches dhtmlxRibbon from component's top
    //detachStatusBar	detaches status bar object from component's bottom
    //detachToolbar	detaches dhtmlxToolbar from component's top
    //dockWindow	docks content from the window to layout cell
    //forEachItem	iterator, calls a user-defined function for each cell
    //getAttachedMenu	returns dhtmlxMenu instance attached to component's top
    //getAttachedRibbon	returns dhtmlxRibbon instance attached to component's top
    //getAttachedStatusBar	returns status bar object attached to component's bottom
    //getAttachedToolbar	returns dhtmlxToolbar instance attached to component's top
    //getEffect	returns true if the effect is enabled
    //getIdByIndex	returns cell id by index
    //getIndexById	returns cell index by id
    //hideMenu	hides dhtmlxMenu attached to component's top
    //hidePanel	hides cell header
    //hideRibbon	hides dhtmlxRibbon attached to component's top
    //hideStatusBar	hides status bar object attached to component's bottom
    //hideToolbar	hides dhtmlxToolbar attached to component's top
    //isPanelVisible	returns true, if cell header is visible
    //listAutoSizes	returns array with autosize settings for loaded layout (depends on pattern)
    //listPatterns	returns array with available layout patterns
    //listViews	returns array with available layout patterns
    //progressOff	hides progress indicator for full component
    //progressOn	shows progress indicator for full component
    //setAutoSize	sets autosize for the layout
    //setCollapsedText	sets text for collapsed cell
    //setEffect	sets effect
    //setImagePath	sets path to images
    //setOffsets	sets offsets for parent container from each side
    //setSeparatorSize	sets the width of a separator line in pixels
    //setSizes	adjusts layout's outer size when parent's size changed
    //setSkin	sets skin
    //showMenu	shows dhtmlxMenu attached to component's top
    //showPanel	shows cell header
    //showRibbon	shows dhtmlxRibbon attached to component's top
    //showStatusBar	shows status bar object attached to component's bottom
    //showToolbar	shows dhtmlxToolbar attached to component's bottom
    //unDockWindow	undocks content from layout cell to the window
    //unload	destructor, unloads layout
  end;

  { TTreeview }

  { TLayout }

  TLayout = class
  private
    FControl : TDHTMLXLayout;
    function getCell(name : string): TDHTMLXLayoutCell;
  public
    constructor Create(parent : JSValue;layout : string);
    property Cells[name : string] : TDHTMLXLayoutCell read getCell ;            //returns the cell object by the id
  end;

implementation

{ TSidebar }

function TLayout.getCell(name : string): TDHTMLXLayoutCell;
begin
  Result := FControl.cells(name);
end;

constructor TLayout.Create(parent: JSValue; layout: string);
begin
  FControl := TDHTMLXLayout.New(new(['parent',parent,'pattern',layout]));
end;

end.

