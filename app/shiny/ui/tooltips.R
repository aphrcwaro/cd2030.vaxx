use_tooltips <- function() {
  tags$script(HTML("
    $(function(){
      $('body').tooltip({ selector: '[data-toggle=\"tooltip\"]', container: 'body' });
    });
  "))
}

tooltip_icon <- function(text, placement = "right", icon = "info-circle") {
  tags$i(
    class = paste0("fa fa-", icon),
    `data-toggle`   = "tooltip",
    `data-placement`= placement,
    title           = tooltip_text(text),
    tabindex        = 0,
    role            = "img",
    `aria-label`    = tooltip_text(text),
    style           = "cursor:pointer;margin-left:6px;"
  )
}

tooltip_label <- function(label, text, placement = "right", icon = "info-circle") {
  tagList(label, tooltip_icon(text, placement, icon))
}

tooltip_text <- function(x, collapse = " ") {
  if (is.null(x) || length(x) == 0) return("")
  if (length(x) > 1) x <- paste(x, collapse = collapse)
  
  if (inherits(x, c("shiny.tag","shiny.tag.list","html","html_dependency")))
    x <- htmltools::renderTags(x)$html
  x <- gsub("<[^>]+>", "", as.character(x))
  x <- gsub("\\s+", " ", x)
  trimws(x)
}
