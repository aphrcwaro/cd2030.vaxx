source('modules/1a_internal_consistency/ratios.R')
source('modules/1a_internal_consistency/consistency_check.R')

internalConsistencyUI <- function(id, i18n) {
  ns <- NS(id)
  
  countdownDashboard(
    dashboardId =ns('internal_consistency'),
    dashboardTitle = i18n$t('title_consistency'),
    i18n = i18n,
    
    countdownOptions = countdownOptions(
      title = i18n$t('title_options'),
      
      column(3, numericInput(ns('anc1_coverage'),
                             i18n$t("title_anc1_coverage"),
                             min = 0, max = 100, value = NA, step = 1)),
      column(3, numericInput(ns('penta1_coverage'),
                             i18n$t("title_penta1_coverage"),
                             min = 0, max = 100, value = NA, step = 1)),
      column(3, numericInput(ns('penta3_coverage'),
                             i18n$t("title_penta3_coverage_pct"),
                             min = 0, max = 100, value = NA, step = 1)),
      column(12, fluidRow(
        column(3, numericInput(ns('opv1_coverage'),
                               i18n$t("title_opv1_coverage_pct"),
                               min = 0, max = 100, value = NA, step = 1)),
        column(3, numericInput(ns('opv3_coverage'),
                               i18n$t("title_opv3_coverage_pct"),
                               min = 0, max = 100, value = NA, step = 1))
      ))
    ),
    
    calculateRatiosUI(ns('ratios'), i18n = i18n),
    consistencyCheckUI(ns('consistency'), i18n = i18n)
  )
}

internalConsistencyServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))
  
  moduleServer(
    id = id,
    module = function(input, output, session) {
      
      calculateRatiosServer('ratios', cache, i18n)
      consistencyCheckServer('consistency', cache, i18n)
      
      data <- reactive({
        if (isTruthy(cache) && is.reactive(cache)) {
          TRUE
        } else {
          FALSE
        }
      })
      
      updating <- reactiveVal(FALSE)  # <-- guard flag
      
      observe({
        req(cache())
        estimates <- cache()$survey_estimates
        
        # guard to avoid feedback loop
        updating(TRUE)
        on.exit(updating(FALSE), add = TRUE)
        
        # prevent triggering change observers while we programmatically set values
        freezeReactiveValue(input, "anc1_coverage")
        freezeReactiveValue(input, "penta1_coverage")
        freezeReactiveValue(input, "penta3_coverage")
        freezeReactiveValue(input, "opv1_coverage")
        freezeReactiveValue(input, "opv3_coverage")
        
        updateNumericInput(session, "anc1_coverage",  value = unname(estimates[["anc1"]]))
        updateNumericInput(session, "penta1_coverage", value = unname(estimates[["penta1"]]))
        updateNumericInput(session, "penta3_coverage", value = unname(estimates[["penta3"]]))
        updateNumericInput(session, "opv1_coverage",   value = unname(estimates[["opv1"]]))
        updateNumericInput(session, "opv3_coverage",   value = unname(estimates[["opv3"]]))
      })
      
      # Causing a loop the national_rates.R
      observeEvent(c(input$anc1_coverage, input$penta1_coverage, input$penta3_coverage, 
                     input$opv1_coverage, input$opv3_coverage), {
        req(cache(), !isTRUE(updating()))
        
        # current inputs
        new_est <- c(
          anc1    = as.numeric(input$anc1_coverage),
          penta1  = as.numeric(input$penta1_coverage),
          penta3  = as.numeric(input$penta3_coverage),
          opv1    = as.numeric(input$opv1_coverage),
          opv3    = as.numeric(input$opv3_coverage)
        )
        
        # existing cache (ensure function call)
        old <- cache()$survey_estimates
        # keep other indicators intact
        new_all <- c(old)
        new_all[names(new_est)] <- new_est
        
        # write only if something actually changed
        if (!identical(unname(old[names(new_est)]), unname(new_est))) {
          cache()$set_survey_estimates(new_all)
          if (!identical(cache()$survey_source, 'ratios')) {
            cache()$set_survey_source('ratios')
          }
        }
      }, ignoreInit = TRUE, priority = 0)
      
      countdownHeaderServer(
        'internal_consistency',
        cache = cache,
        path = 'numerator-assessment',
        section = 'sec-dqa-consistency',
        i18n = i18n
      )
    }
  )
}
