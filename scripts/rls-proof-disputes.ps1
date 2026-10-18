# Proof for payment disputes (19 Oct 2026, 20261031090000). The questions:
#   * only the person PAID raises a dispute on a team payment - not the payer,
#     not a teammate, not a stranger
#   * one open dispute per entry
#   * only the PAYER answers it; an answered dispute cannot be answered again
#   * only whoever raised it withdraws it, and only while it is open
#   * a dispute is read by its two ends and by nobody else; nothing writes the
#     table directly
#   * a dispute moves no money: the payment is untouched by accept or reject
#
# Reads keys from .env.local - run from the repo root:
#   powershell -File scripts/rls-proof-disputes.ps1
$ErrorActionPreference = "Stop"
$PSDefaultParameterValues = @{ "Invoke-RestMethod:UserAgent" = "danceos-proof"; "Invoke-WebRequest:UserAgent" = "danceos-proof" }

$envFile = Join-Path $PSScriptRoot "..\.env.local"
$vars = @{}
Get-Content $envFile | Where-Object { $_ -match "^\s*[A-Z_]+\s*=" } | ForEach-Object {
  $name, $value = $_ -split "=", 2
  $vars[$name.Trim()] = $value.Trim()
}
$base = $vars["NEXT_PUBLIC_SUPABASE_URL"]
$anon = $vars["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
$service = $vars["SUPABASE_SERVICE_ROLE_KEY"]
if (-not $base -or -not $anon -or -not $service) { throw "Supabase keys missing from .env.local" }

$svcH = @{ apikey = $service; Authorization = "Bearer $service"; "Content-Type" = "application/json"; Prefer = "return=representation" }
. (Join-Path $PSScriptRoot "proof-lib.ps1")
$adminH = @{ apikey = $service; Authorization = "Bearer $service"; "Content-Type" = "application/json" }
$anonH = @{ apikey = $anon; "Content-Type" = "application/json" }

function Api($token) { return @{ apikey = $anon; Authorization = "Bearer $token"; "Content-Type" = "application/json"; Prefer = "return=representation" } }
function Rpc($headers, $fn, $body) {
  return Invoke-RestMethod -Method Post -Uri "$base/rest/v1/rpc/$fn" -Headers $headers -Body ($body | ConvertTo-Json)
}
function Get-Rows($headers, $path) {
  $res = Invoke-WebRequest -Method Get -Uri "$base/rest/v1/$path" -Headers $headers -UseBasicParsing
  return ,@(($res.Content | ConvertFrom-Json) | Where-Object { $null -ne $_ })
}
function Expect-Fail($script) { try { & $script | Out-Null; return $false } catch { return $true } }
function Check($n, $label, $ok) {
  "$n. $label $(if ($ok) {'-- OK'} else {'-- !!! FAILED !!!'})"
  if (-not $ok) { $script:pass = $false }
}

function New-EmailUser($email, $name) {
  $u = Invoke-RestMethod -Method Post -Uri "$base/auth/v1/admin/users" -Headers $adminH -Body (@{
    email = $email; password = "Proof-passw0rd!"; email_confirm = $true } | ConvertTo-Json)
  Invoke-RestMethod -Method Post -Uri "$base/rest/v1/profiles" -Headers $svcH -Body (@{
    id = $u.id; full_name = $name; role = "user"; city = "Pune"; created_by = $u.id; updated_by = $u.id } | ConvertTo-Json) | Out-Null
  $tok = Invoke-RestMethod -Method Post -Uri "$base/auth/v1/token?grant_type=password" -Headers $anonH -Body (@{
    email = $email; password = "Proof-passw0rd!" } | ConvertTo-Json)
  return [pscustomobject]@{ id = $u.id; email = $email; token = $tok.access_token }
}
function Add-Member($tenantId, $userId, $memberRole, $byUser) {
  Invoke-RestMethod -Method Post -Uri "$base/rest/v1/business_members" -Headers $svcH -Body (@{
    business_id = $tenantId; user_id = $userId; member_role = $memberRole
    created_by = $byUser; updated_by = $byUser } | ConvertTo-Json) | Out-Null
}

$pass = $true
$stamp = Get-Date -Format "HHmmss"
$owner = New-EmailUser "dispproof-owner-$stamp@example.com" "Owner $stamp"
$paid = New-EmailUser "dispproof-paid-$stamp@example.com" "Paid $stamp"
$mate = New-EmailUser "dispproof-mate-$stamp@example.com" "Mate $stamp"
$rival = New-EmailUser "dispproof-rival-$stamp@example.com" "Rival $stamp"
$ta = New-Studio $owner.token "Disp Studio $stamp" "Kothrud" "Pune"
Add-Member $ta.id $paid.id "trainer" $owner.id
Add-Member $ta.id $mate.id "trainer" $owner.id

try {
  Rpc (Api $owner.token) "record_team_payment" @{ p_business_id = $ta.id; p_user_id = $paid.id; p_amount_inr = 2500;
    p_method = "upi"; p_status = "done"; p_paid_on = $null; p_note = "October" } | Out-Null
  $pay = (Get-Rows $svcH "payouts?business_id=eq.$($ta.id)&user_id=eq.$($paid.id)&deleted_at=is.null&select=id,amount_inr")[0]

  # 1. only the person paid raises it
  $ownerRaise = Expect-Fail { Rpc (Api $owner.token) "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "not mine"; p_claimed_inr = $null } }
  $mateRaise = Expect-Fail { Rpc (Api $mate.token) "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "not mine"; p_claimed_inr = $null } }
  $rivalRaise = Expect-Fail { Rpc (Api $rival.token) "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "not mine"; p_claimed_inr = $null } }
  $anonRaise = Expect-Fail { Rpc $anonH "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "not mine"; p_claimed_inr = $null } }
  Check 1 "The payer, a teammate, a stranger and the public cannot raise it" ($ownerRaise -and $mateRaise -and $rivalRaise -and $anonRaise)

  # 2. the person paid raises it, with what they say it should have been
  $shortBlocked = Expect-Fail { Rpc (Api $paid.token) "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "x"; p_claimed_inr = $null } }
  $d1 = Rpc (Api $paid.token) "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "It was Rs 3000 for October"; p_claimed_inr = 3000 }
  $row = (Get-Rows $svcH "payment_disputes?id=eq.$d1&select=status,claimed_inr,amount_inr")[0]
  Check 2 "A two-letter reason is refused ($shortBlocked); the person paid raises one (open, claims Rs $($row.claimed_inr) on Rs $($row.amount_inr))" (
    $shortBlocked -and ($row.status -eq "open") -and ($row.claimed_inr -eq 3000) -and ($row.amount_inr -eq 2500))

  # 3. one open dispute per entry
  $twice = Expect-Fail { Rpc (Api $paid.token) "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "again please"; p_claimed_inr = $null } }
  Check 3 "A second open dispute on the same entry is refused" $twice

  # 4. read by its two ends only; nothing writes the table directly
  $byPaid = Get-Rows (Api $paid.token) "payment_disputes?id=eq.$d1&select=id"
  $byOwner = Get-Rows (Api $owner.token) "payment_disputes?id=eq.$d1&select=id"
  $byMate = Get-Rows (Api $mate.token) "payment_disputes?id=eq.$d1&select=id"
  $byRival = Get-Rows (Api $rival.token) "payment_disputes?id=eq.$d1&select=id"
  $anonRead = Expect-Fail { Get-Rows $anonH "payment_disputes?select=id" }
  $directWrite = Expect-Fail {
    Invoke-RestMethod -Method Post -Uri "$base/rest/v1/payment_disputes" -Headers (Api $paid.token) -Body (@{
      kind = "payout"; target_id = $pay.id; reason = "direct" } | ConvertTo-Json)
  }
  Check 4 "Paid ($($byPaid.Count)) and payer ($($byOwner.Count)) read it; teammate ($($byMate.Count)), rival ($($byRival.Count)) and public cannot; no direct insert" (
    ($byPaid.Count -eq 1) -and ($byOwner.Count -eq 1) -and ($byMate.Count -eq 0) -and ($byRival.Count -eq 0) -and $anonRead -and $directWrite)

  # 5. only the payer answers
  $paidAnswers = Expect-Fail { Rpc (Api $paid.token) "answer_payment_dispute" @{ p_id = $d1; p_accept = $true; p_response = $null } }
  $mateAnswers = Expect-Fail { Rpc (Api $mate.token) "answer_payment_dispute" @{ p_id = $d1; p_accept = $true; p_response = $null } }
  Rpc (Api $owner.token) "answer_payment_dispute" @{ p_id = $d1; p_accept = $false; p_response = "It was agreed at 2500" } | Out-Null
  $answered = (Get-Rows $svcH "payment_disputes?id=eq.$d1&select=status")[0]
  $again = Expect-Fail { Rpc (Api $owner.token) "answer_payment_dispute" @{ p_id = $d1; p_accept = $true; p_response = $null } }
  Check 5 "The paid person and a teammate cannot answer; the payer rejects it ($($answered.status)) and cannot answer twice" (
    $paidAnswers -and $mateAnswers -and ($answered.status -eq "rejected") -and $again)

  # 6. a dispute moves no money
  $after = (Get-Rows $svcH "payouts?id=eq.$($pay.id)&select=amount_inr,deleted_at")[0]
  Check 6 "The payment is untouched (Rs $($after.amount_inr), live)" (($after.amount_inr -eq 2500) -and ($null -eq $after.deleted_at))

  # 7. after an answer a fresh dispute may be raised; only its raiser withdraws it
  $d2 = Rpc (Api $paid.token) "raise_payment_dispute" @{ p_kind = "payout"; p_target_id = $pay.id; p_reason = "Asking once more"; p_claimed_inr = $null }
  $ownerWithdraw = Expect-Fail { Rpc (Api $owner.token) "withdraw_payment_dispute" @{ p_id = $d2 } }
  Rpc (Api $paid.token) "withdraw_payment_dispute" @{ p_id = $d2 } | Out-Null
  $w = (Get-Rows $svcH "payment_disputes?id=eq.$d2&select=status")[0]
  $withdrawAgain = Expect-Fail { Rpc (Api $paid.token) "withdraw_payment_dispute" @{ p_id = $d2 } }
  Check 7 "A fresh dispute after an answer; the payer cannot withdraw it; its raiser does ($($w.status)), once" (
    $ownerWithdraw -and ($w.status -eq "withdrawn") -and $withdrawAgain)
}
finally {
  Invoke-ProofCleanup "disputes" {
    Invoke-RestMethod -Method Delete -Uri "$base/rest/v1/businesses?id=eq.$($ta.id)" -Headers $svcH | Out-Null
    foreach ($u in @($owner, $paid, $mate, $rival)) {
      Invoke-RestMethod -Method Delete -Uri "$base/auth/v1/admin/users/$($u.id)" -Headers $adminH | Out-Null
    }
  }
  "   (cleanup: proof studio and throwaway accounts deleted)"
}

if ($pass) { "`nALL DISPUTE CHECKS PASSED"; exit 0 } else { "`nDISPUTE CHECKS FAILED"; exit 1 }
