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
      
      tabPanel(title = i18n$t("opt_penta3"), downloadCoverageUI(ns('penta3'))),
      tabPanel(title = i18n$t("opt_mcv1"), downloadCoverageUI(ns('measles1'))),
      tabPanel(
        title = i18n$t("opt_custom_check"),
        fluidRow(
          column(3, indicatorSelect(ns('indicator'), i18n))
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

      indicator <- indicatorSelectServer('indicator', cache)
      denominatorInputServer('denominator', cache, i18n)

      coverage <- reactive({
        req(cache(), cache()$check_coverage_params)
        cache()$calculate_coverage('national')
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
        req(coverage(), indicator())
        coverage() %>%
          filter_coverage(indicator(), denominator = cache()$get_denominator(indicator()))
      })

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
        filename = reactive(paste0(indicator(), '_survey_', cache()$get_denominator(indicator()))),
        data_fn = custom_coverage,
        sheet_name = reactive(paste(indicator(), i18n$t("title_coverage"))),
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
