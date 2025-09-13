denominatorInputUI <- function(id, i18n) {
  ns <- NS(id)
  uiOutput(ns('denominator_ui'))
}

denominatorInputServer <- function(id, cache, i18n, label = 'title_denominator', allowInput = FALSE, maternal = FALSE) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      ns = session$ns

      denominator <- reactive({
        req(cache())
        if (maternal) cache()$maternal_denominator else cache()$denominator
      })

      observeEvent(input$denominator, {
        req(cache(), input$denominator, allowInput)
        if (maternal) {
          cache()$set_maternal_denominator(input$denominator)
        } else {
          cache()$set_denominator(input$denominator)
        }
      })

      output$denominator_ui <- renderUI({
        if (allowInput) {
          selectizeInput(
            ns('denominator'),
            label = i18n$t(label),
            choices = c(
              'DHIS2' = 'dhis2',
              'ANC 1' = 'anc1',
              'Penta 1' = 'penta1',
              'Penta 1 Population Growth' = 'penta1derived'
            ),
            selected = denominator()
          )
        } else {
          tags$div(
            tags$label(class = 'control-label', i18n$t(label)),
            tags$p(
              tags$b('Vaccination'), ': ', cache()$denominator, tags$br(),
              tags$b('Maternal'), ': ', cache()$maternal_denominator
            )
          )
        }
      })
    }
  )
}
