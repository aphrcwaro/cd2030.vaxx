selectTooltipInput <- function(id, i18n, label, tooltip = NULL, choices = NULL) {
  ns <- NS(id)
  
  label <- i18n$t(label)
  tooltip <- if (!is.null(tooltip)) i18n$t(tooltip) else NULL
  selectizeInput(ns('select'),
                 label = if (is.null(tooltip)) label else tooltip_label(label, tooltip),
                 choices = choices)
}

selectTooltipServer <- function(id, selected = reactive(NULL)) {
  stopifnot(is.reactive(selected))
  moduleServer(
    id = id,
    module = function(input, output, session) {
      observe({
        session$onFlushed(function() {
          session$sendCustomMessage("reinit-tooltips", TRUE)
        }, once = TRUE)
      })
      
      observe({
        req(selected())
        updateSelectInput(session, 'select', selected = selected())
      })
      
      return(reactive(input$select))
    }
  )
}