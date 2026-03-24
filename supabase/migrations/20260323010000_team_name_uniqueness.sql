create unique index if not exists teams_name_lower_unique
  on teams ((lower(name)));
