use serde::Deserialize;

#[derive(Deserialize)]
pub struct DateRangeParams {
    pub from: Option<String>,
    pub to: Option<String>,
    pub agent: Option<String>,
}

impl DateRangeParams {
    /// Returns (from_date, to_date) with 30-day default window
    pub fn resolve(&self) -> (String, String) {
        let to = self.to.clone().unwrap_or_else(|| {
            chrono::Utc::now().format("%Y-%m-%d").to_string()
        });
        let from = self.from.clone().unwrap_or_else(|| {
            (chrono::Utc::now() - chrono::Duration::days(30))
                .format("%Y-%m-%d")
                .to_string()
        });
        (from, to)
    }
}

#[derive(Deserialize)]
pub struct PaginationParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub sort: Option<String>,
    pub order: Option<String>,
}

impl PaginationParams {
    /// Returns (page, limit, sort, order) with defaults: page=1, limit=20, sort="date", order="desc"
    pub fn resolve(&self) -> (u32, u32, String, String) {
        let page = self.page.unwrap_or(1);
        let limit = self.limit.unwrap_or(20);
        let sort = self.sort.clone().unwrap_or_else(|| "date".to_string());
        let order = self.order.clone().unwrap_or_else(|| "desc".to_string());
        (page, limit, sort, order)
    }
}
