dhtmlxEvent(window,"load",function(){                          //provides your script as a handler of the 'onload' HTML event

  dhtmlXSideBar.prototype.templates.icontext =
  // icon 32x32
  "<img class='dhxsidebar_item_icon' src='#icons_path##icon#' border='0'>"+
  // general area for text
  "<div class='dhxsidebar_item_text'>"+
    "<div class='line_one'>#text#</div>"+ // 1st line of text
    "<div class='line_two'>#text2#</div>"+ // 2nd line of text
  "</div>";
  dhtmlXSideBar.prototype.templates.text =
  // general area for text
  "<div class='dhxsidebar_item_text'>"+
    "<div class='line_one'>#text#</div>"+ // 1st line of text
    "<div class='line_two'>#text2#</div>"+ // 2nd line of text
  "</div>";
});
