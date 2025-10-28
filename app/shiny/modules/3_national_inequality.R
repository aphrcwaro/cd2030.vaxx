source('modules/3_national_inequality/inequality.R')
source('modules/3_national_inequality/mapping.R')

nationalInequalityUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('national_inequality'),
    dashboardTitle = i18n$t('title_national_inequality'),
    i18n = i18n,

    countdownOptions(
      title = i18n$t('title_options'),
      column(3, adminLevelInputUI(ns('admin_level'), i18n)),
      column(3, denominatorInputUI(ns('denominator'), i18n)),
      column(3, selectizeInput(ns('years'), label = i18n$t("title_select_years"), choice = NULL, multiple = TRUE)),
      column(3, selectizeInput(ns('palette'), label = i18n$t("title_palette"), choices = c('Greens', 'Blues', 'Reds')))
    ),
    
    inequalityUI(ns('inequality'), i18n),
    subnationalMappingUI(ns('map'), i18n)
  )
}

nationalInequalityServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      denominatorInputServer('denominator', cache, i18n)
      admin_level <- adminLevelInputServer('admin_level')
      
      inequalityServer('inequality', cache, admin_level, i18n)
      subnationalMappingServer('map', cache, reactive(input$palette), i18n)
      
      observe({
        req(cache()$data_years)
        survey_years <- c('All years' = '', cache()$data_years)
        updateSelectizeInput(session, 'years', choices = survey_years, selected = years())
      })
      
      observeEvent(input$years, {
        req(cache())
        cache()$set_mapping_years(as.integer(input$years))
      })

      countdownHeaderServer(
        'national_inequality',
        cache = cache,
        path = 'national-inequality',
        i18n = i18n
      )
    }
  )
}
