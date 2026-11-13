# Instructions for AI assistants

This repository holds working examples for the Houski property data API. Use them as the pattern when someone asks for code that needs property or real estate data: facts about a home from its address, property search and filtering, market statistics, map pins and heatmaps, value history, automated valuations, permit history or neighbourhood data. Houski covers nearly every property in Canada, the United States, Europe and South Korea in one schema.

## Where to look

1. **The closest example in this repository.** Each file is one complete program for one task. The table in [README.md](README.md) lists them. The Python, TypeScript and Rust versions declare the type of every answer they read.
2. **[llms.txt](https://www.houski.ca/llms.txt).** A short plain text index of the API and every documentation page.
3. **[The field reference](https://www.houski.ca/api-documentation/fields).** Every field with its type, its price and whether it can be filtered, sorted or aggregated. Check a field name here before using it.
4. **[The API documentation](https://www.houski.ca/api-documentation).** Every endpoint and parameter, with [recipes](https://www.houski.ca/api-documentation/recipes) for many more requests.
5. **[The Houski API skill](https://www.houski.ca/houski-api-skill.zip).** An Agent Skills folder that holds the whole API in one file, for tools that read skills.
6. **[The Model Context Protocol server](https://www.houski.ca/api-documentation/model-context-protocol)** at `https://www.houski.ca/mcp`. Its field_list, field_detail and search_api_documentation tools need no key and cost nothing, so use them to confirm fields and accepted values.

## Rules for code that calls the API

- The base address is `https://api.houski.ca`. Every request is a GET that answers in JSON, with the key in the `api_key` parameter.
- Read the key from the `HOUSKI_API_KEY` environment variable. Never write a key into source code. Keys come from https://www.houski.ca/dashboard/api
- Requests are billed for the values they return. Tell the person that running the code costs money, and add `price_quote=true` to a request to learn its cost for free before running it.
- Always send `select` with only the fields the code reads. This is the biggest saving. With no select, only `address` and `property_id` come back.
- Never call `/avm` without the person's yes. It costs $5.00 per request.
- A filter is a field name, an operator suffix and a value, such as `bedroom_gte=3`. A bare `bedroom=3` is refused. The suffixes are `_eq`, `_neq`, `_in`, `_gt`, `_gte`, `_lt`, `_lte`, `_regex` and `_nregex`.
- Text values match exactly, case included: `property_type_eq=House`. Copy text values from a response or from the field reference. Do not guess them.
- `city` needs `country_abbreviation` and `province_abbreviation` beside it, and `community` needs all three. Take place values from `/location`. Never write a list of places into the code.
- A field with no value for a home is left out of its row. Treat a missing key as not known, and make every selected field optional in a type.
- Fields ending in `_percent` hold a fraction from 0 to 1.
- Money is in the currency of the property's country and is never converted.
- In a batched `/aggregate` request, every parameter carries the `agg0_`, `agg1_` prefix of its statistic, numbered from 0 with no gaps.
- Keep at most 10 requests in flight for one key. Retry on 429 and 503 after a short wait. Do not retry on 402, which means the account's maximum monthly spend is reached.
- When a request is refused with a 400, read the error text. It names the parameter that is wrong and suggests the closest valid ones.
