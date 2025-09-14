nationalCoverageUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('national_coverage'),
    dashboardTitle = i18n$t('title_national_coverage'),
    i18n = i18n,

    countdownOptions = countdownOptions(
      title = i18n$t('title_analysis_options'),
      column(3, denominatorInputUI(ns('denominator'), i18n))
    ),

    tabBox(
      title = i18n$t('title_national_coverage'),
      width = 12,

      tabPanel(title = i18n$t("opt_anc4"), downloadCoverageUI(ns('anc4'))),
      tabPanel(title = i18n$t("opt_livebirths"), downloadCoverageUI(ns('livebirths'))),
      tabPanel(title = i18n$t("opt_lbw"), downloadCoverageUI(ns('lbw'))),
      tabPanel(title = i18n$t("opt_penta3"), downloadCoverageUI(ns('penta3'))),
      tabPanel(title = i18n$t("opt_mcv1"), downloadCoverageUI(ns('measles1'))),
      tabPanel(
        title = i18n$t("opt_custom_check"),
        fluidRow(
          column(3, selectizeInput(ns('indicator'), label = i18n$t("title_indicator"),
                                   choices = c('Select' = '', get_indicator_without_opd_ipd())))
        ),
        downloadCoverageUI(ns('custom'))
      )
    )
  )
}

nationalCoverageServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {

      denominatorInputServer('denominator', cache, i18n)

      coverage <- reactive({
        req(cache(), cache()$check_coverage_params)
        cache()$calculate_coverage('national')
      })

      anc4_coverage <- reactive({
        req(coverage())
        coverage() %>%
          filter_coverage('anc4', denominator = cache()$get_denominator('anc4'))
      })

      livebirths_coverage <- reactive({
        req(coverage())
        coverage() %>%
          filter_coverage('instlivebirths', denominator = cache()$get_denominator('instlivebirths'))
      })

      lbw_coverage <- reactive({
        req(coverage())
        coverage() %>%
          filter_coverage('low_bweight', denominator = cache()$get_denominator('low_bweight'))
      })

      penta3_coverage <- reactive({
        req(coverage())
        coverage() %>%
          filter_coverage('penta3', denominator = cache()$get_denominator('penta3'))
      })

      measles1_coverage <- reactive({
        req(coverage())
        coverage() %>%
          filter_coverage('measles1', denominator = cache()$get_denominator('measles1'))
      })

      custom_coverage <- reactive({
        req(coverage(), input$indicator)
        coverage() %>%
          filter_coverage(input$indicator, denominator = cache()$get_denominator(input$indicator))
      })

      downloadCoverageServer(
        id = 'anc4',
        filename = reactive(paste0('anc4_survey_', cache()$get_denominator('anc4'))),
        data_fn = anc4_coverage,
        sheet_name = reactive(i18n$t("title_anc4")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'livebirths',
        filename = reactive(paste0('livebirths_survey_', cache()$get_denominator('instlivebirths'))),
        data_fn = livebirths_coverage,
        sheet_name = reactive(i18n$t("title_livebirths_coverage")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'lbw',
        filename = reactive(paste0('lbw_survey_', cache()$get_denominator('low_bweight'))),
        data_fn = lbw_coverage,
        sheet_name = reactive(i18n$t("title_lbw_coverage")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'penta3',
        filename = reactive(paste0('penta3_survey_', cache()$get_denominator('penta3'))),
        data_fn = penta3_coverage,
        sheet_name = reactive(i18n$t("title_penta1_coverage")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive(paste0('measles1_survey_', cache()$get_denominator('measles1'))),
        data_fn = measles1_coverage,
        sheet_name = reactive(i18n$t("title_mcv1_coverage")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(input$indicator, '_survey_', cache()$get_denominator(input$indicator))),
        data_fn = custom_coverage,
        sheet_name = reactive(paste(input$indicator, i18n$t("title_coverage"))),
        i18n = i18n
      )

      countdownHeaderServer(
        'national_coverage',
        cache = cache,
        path = 'national-coverage',
        i18n = i18n
      )
    }
  )
}
