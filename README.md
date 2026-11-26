# 미국 비즈니스 뉴스

미국 주요 언론의 비즈니스 기사를 날짜별로 읽는 정적 사이트입니다. 기본 브랜치는 `main`입니다. 브라우저가 `data/index.json`에서 가장 최신 발행일을 선택하고 해당 날짜의 JSON을 읽습니다. 날짜를 바꾸면 선택한 언론사와 검색어가 유지됩니다.

- [GitHub Pages에서 열기](https://sowol244.github.io/us-business-news/)
- [Vercel에서 열기](https://usnews-sowol.vercel.app/)

## 날짜 인덱스

[인덱스 스키마](schemas/index.schema.json) · [사용 중인 인덱스](data/index.json)

`schemaVersion`은 `1`, `timeZone`은 `America/New_York`입니다. `updatedAt`은 마지막 데이터 갱신 시각을 UTC로 기록합니다. `issues`는 `date`와 `articleCount`를 가진 객체의 배열입니다. 날짜는 `YYYY-MM-DD` 형식이며 최신순으로 한 번씩 나열합니다. 건수는 그 날짜 파일의 기사 수입니다. 최초에 기사가 없다면 `issues`는 `[]`, `updatedAt`은 `null`입니다.

## 날짜별 파일

[기사 스키마](schemas/daily.schema.json) · [원문을 확인한 기사 데이터 예시](data/2026-11-24.json)

`data/YYYY-MM-DD.json`은 `schemaVersion: 1`, `kind: "news"`, `date`, `articles`를 포함합니다. `date`는 파일명과 같으며, 각 기사의 `publishedAt`을 미국 동부시간으로 변환한 발행일입니다. 미국 서머타임은 `America/New_York` 시간대 규칙을 적용합니다. 테스트 데이터에는 `kind: "test"`를 사용하고 공개 인덱스와 발행 경로에는 올리지 않습니다. 웹사이트는 `"news"` 파일만 기사로 표시합니다.

| 기사 필드 | 값 |
| --- | --- |
| `id` | `source + ":" + url`로 만든 고정 ID. 날짜 파일 안에서 중복할 수 없습니다. |
| `source` | 아래 표의 언론사 코드입니다. |
| `titleOriginal` | 언론사가 표시한 영어 제목입니다. 최대 240자입니다. |
| `titleKo` | 한국어 제목입니다. 최대 180자입니다. |
| `summaryKo` | 확인된 내용의 한국어 요약을 문장별 배열에 담습니다. `full`과 `partial`은 1~3문장, `headline`은 빈 배열입니다. 각 문장은 최대 220자입니다. |
| `url` | 해당 언론사의 정식 HTTPS 기사 주소입니다. 쿼리 문자열과 프래그먼트를 제거한 주소를 사용합니다. |
| `publishedAt` | 원문에 확인된 최초 발행 시각입니다. |
| `access` | `free`는 비구독 열람 확인, `paywall`은 유료 구독 장벽 확인, `unknown`은 유료 여부 미확인입니다. |
| `verification` | `full`은 본문 전체, `partial`은 공개된 설명 또는 본문 일부, `headline`은 제목과 발행 시각을 확인했다는 뜻입니다. |
| `collectedAt` | 기사 정보와 확인 범위를 최종 확인한 시각입니다. |

`publishedAt`, `collectedAt`, `updatedAt`은 UTC `YYYY-MM-DDTHH:mm:ssZ`입니다. 원문이 분 단위로 표시할 때는 초를 `00`으로 적습니다. `publishedAt ≤ collectedAt ≤ updatedAt`이어야 합니다. 화면의 시각은 동부시간으로 표시합니다.

| 코드 | 언론사 | 기사 주소 도메인 |
| --- | --- | --- |
| `wsj` | The Wall Street Journal | `wsj.com` |
| `nyt` | The New York Times | `nytimes.com` |
| `washpost` | The Washington Post | `washingtonpost.com` |
| `latimes` | Los Angeles Times | `latimes.com` |
| `bloomberg` | Bloomberg | `bloomberg.com` |
| `reuters` | Reuters | `reuters.com` |
| `cnbc` | CNBC | `cnbc.com` |
| `marketwatch` | MarketWatch | `marketwatch.com` |
| `ft` | Financial Times | `ft.com` |
| `ap` | Associated Press | `apnews.com` |

## GitHub에서 데이터 추가 및 갱신

1. `sowol244/us-business-news`의 `main`에서 최신 커밋과 인덱스를 읽습니다. 해당 날짜 파일이 있다면 기존 기사도 읽습니다.
2. 새 기사를 날짜 파일에 추가합니다. 같은 ID의 기사는 하나만 남기고, 새로 확인한 정정은 해당 항목에 반영합니다. 기사 없는 날짜는 새 항목으로 만들지 않습니다.
3. 해당 날짜의 기사 수를 인덱스에 맞추고 `updatedAt`을 갱신 시각으로 변경합니다. 인덱스에는 이전 날짜를 보존합니다. 날짜 파일과 인덱스를 한 커밋으로 올리면 두 파일이 함께 갱신됩니다.
4. 업데이트가 충돌하면 현재 `main`의 파일을 다시 읽고 병합한 후 재시도합니다. 저장한 파일과 커밋을 다시 읽어 날짜, 건수, 기사 ID를 확인합니다.
5. Pages와 Vercel의 배포가 끝나면 공개 인덱스와 날짜 파일, 실제 화면을 확인합니다. 사이트는 첫 인덱스 항목을 자동으로 표시합니다.

GitHub에서 발행할 소스는 `main` 브랜치의 `/(root)`입니다. Vercel은 같은 저장소의 `main`을 프로덕션 브랜치로 사용합니다.

## ChatGPT 예약 작업용 프롬프트

ChatGPT에서 예약을 만드실 때 아래 문구를 복사하고 `[하루 최대 기사 수]`를 원하는 숫자로 바꾸세요. 예약 화면에서는 원하시는 실행 시각과 시간대를 선택하세요.

```text
매일 미국 주요 언론의 비즈니스 뉴스를 웹으로 확인하고, 검증한 결과를 공개 GitHub 저장소 sowol244/us-business-news의 main 브랜치에 저장하세요. 하루 최대 [하루 최대 기사 수]건을 선별하세요.

1. America/New_York 기준으로 가장 최근에 끝난 달력일에 처음 발행된 기사만 모으세요. The Wall Street Journal, The New York Times, The Washington Post, Los Angeles Times, Bloomberg, Reuters, CNBC, MarketWatch, Financial Times, Associated Press의 원문을 확인하고, 미국 경제·기업·금융시장에 중요한 기사를 선별하세요. 같은 보도의 재전재본과 중복 URL은 한 건으로 정리하세요.
2. 저장소 README.md와 schemas/daily.schema.json, schemas/index.schema.json을 읽어 형식을 따르세요. 각 기사에서 해당 언론사의 정식 링크, 원문 제목, 최초 발행 날짜·시각을 확인하세요. 발행 시각의 UTC 변환이나 원문 제목을 확인할 수 없는 기사는 제외하세요. 정식 HTTPS URL의 쿼리 문자열과 프래그먼트를 제거하고 source + ":" + url을 기사 ID로 쓰세요.
3. 한글 제목은 사실에 맞게 옮기고 공개 원문에서 확인한 내용만 짧게 요약하세요. 열람 상태는 free, paywall, unknown 중 선택하세요. 확인 범위는 full, partial, headline 중 선택하세요. 공개 제목과 발행 시각만 확인했다면 headline으로 기록하고 summaryKo는 []로 두세요. 본문, 문장 단위 번역, 사진, 결제 장벽 뒤에서 확인하지 못한 내용은 게시하지 마세요. 스키마의 조건에 맞는 실제 기사에만 kind: "news"를 사용하세요.
4. GitHub 연결로 main의 현재 커밋, data/index.json, 대상 날짜 파일을 읽으세요. 기사 ID로 기존 데이터를 보존하며 합치고 실제 기사 수를 인덱스에 반영하세요. 이미 같은 데이터가 있거나 확인된 새 기사가 없으면 그 상태를 보고하세요. 인덱스 날짜는 유일해야 하며 내림차순입니다. 새로 저장하는 경우 index.updatedAt을 실제 저장 시각으로 갱신하세요.
5. 가능한 경우 GitHub의 트리·커밋·브랜치 갱신 기능으로 날짜 파일과 인덱스만 한 번에 저장하세요. 최신 main의 트리를 바탕으로 변경하고 해당 커밋을 부모로 쓰세요. 브랜치는 강제 갱신 없이 앞으로만 이동시키세요. 충돌하면 최신 파일을 다시 읽어 병합하세요. 파일별 쓰기만 가능한 경우, 새 날짜 파일을 먼저 저장·검증한 후 최신 인덱스에 그 날짜를 추가하세요. 이미 인덱스에 있는 날짜의 기사 수가 달라지는 수정은 두 파일을 함께 쓰는 방법이 필요하다고 보고하세요.
6. 저장 후 GitHub에서 두 파일을 다시 읽고 커밋 ID, 발행일(ET), 기사 수를 확인하세요. 공개 배포까지 확인할 수 있으면 페이지 반영 상태도 함께 보고하세요. 저장 또는 사이트 반영이 막히면 어느 단계에서 멈췄는지 설명하세요. 지정 저장소의 뉴스 데이터 파일에만 쓰세요.
```
