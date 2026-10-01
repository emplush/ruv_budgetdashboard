using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace BudgetDashboard.Services;

public static class SignInHelper
{
    public static Task SignInAsync(this HttpContext http, AccountInfo account)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, account.Number),
            new Claim(ClaimTypes.Name, account.Number),
            new Claim(ClaimTypes.Role, account.Role),
            new Claim("stamp", account.Stamp)
        }, CookieAuthenticationDefaults.AuthenticationScheme);
        return http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = false });
    }

    public static string HomeFor(this ClaimsPrincipal user) =>
        user.IsInRole(Models.Roles.Admin) ? "/Admin/Dashboard" : "/Dashboard";
}
