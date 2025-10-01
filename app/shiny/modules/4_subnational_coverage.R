subnationalCoverageUI <- function(id, i18n) {
  ns <- NS(id)

  countdownDashboard(
    dashboardId = ns('subnational_coverage'),
    dashboardTitle = i18n$t('title_subnational_coverage'),
    i18n = i18n,

    countdownOptions = countdownOptions(
      title = i18n$t('title_analysis_options'),
      column(3, adminLevelInputUI(ns('admin_level'), i18n)),
      column(3, regionInputUI(ns('region'), i18n)),
      column(3, denominatorInputUI(ns('denominator'), i18n))
    ),

    tabBox(
      title = i18n$t('title_subnational_coverage'),
      width = 12,

      tabPanel(title = i18n$t("opt_penta1"), downloadCoverageUI(ns('penta1'))),
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

subnationalCoverageServer <- function(id, cache, i18n) {
  stopifnot(is.reactive(cache))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      ns <- session$ns

      admin_level <- adminLevelInputServer('admin_level')
      denominatorInputServer('denominator', cache, i18n)
      region <- regionInputServer('region', cache, admin_level, i18n)
      indicator <- indicatorSelectServer('indicator', cache)

      coverage <- reactive({
        req(cache(), cache()$check_coverage_params, admin_level())
        cache()$calculate_coverage(admin_level())
      })

      penta1_coverage <- reactive({
        req(coverage())
        coverage() %>%
          filter_coverage('penta1', denominator = cache()$get_denominator('penta1'), region = region())
      })

      measles1_coverage <- reactive({
        req(coverage())
        coverage() %>%
          filter_coverage('measles1', denominator = cache()$get_denominator('measles1'), region = region())
      })

      custom_coverage <- reactive({
        req(coverage(), indicator())
        coverage() %>%
          filter_coverage(indicator(), denominator = cache()$get_denominator(indicator()), region = region())
      })

      downloadCoverageServer(
        id = 'penta1',
        filename = reactive(paste0('penta1_', region(), '_survey_', cache()$get_denominator('penta1'))),
        data_fn = penta1_coverage,
        sheet_name = reactive(i18n$t("title_penta1_coverage")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive(paste0('measles1_', region(), '_survey_', cache()$get_denominator('measles1'))),
        data_fn = measles1_coverage,
        sheet_name = reactive(i18n$t("title_mcv1_coverage")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(indicator(), '_', region(), '_survey_', cache()$get_denominator(indicator()))),
        data_fn = custom_coverage,
        sheet_name = reactive(paste(indicator(), i18n$t("title_coverage"))),
        i18n = i18n
      )

      countdownHeaderServer(
        'subnational_coverage',
        cache = cache,
        path = 'subnational-coverage',
        i18n = i18n
      )
    }
  )
}
