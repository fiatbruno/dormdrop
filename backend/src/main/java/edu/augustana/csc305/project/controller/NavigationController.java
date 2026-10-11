
package edu.augustana.csc305.project.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/navigation")
public class NavigationController {

    public record NavigationItem(
            String label,
            String key,
            String path
    ) {}

    @GetMapping("/account")
    public List<NavigationItem> getAccountNavigation() {
        return List.of(
                new NavigationItem(
                        "My Profile", "profile", "/profile"
                ),
                new NavigationItem(
                        "My Listings", "listings", "/my-listings"
                ),
                new NavigationItem(
                        "Settings", "settings", "/settings"
                ),
                new NavigationItem(
                        "Change Password", "password", "/settings/password"
                ),
                new NavigationItem(
                        "Account Security", "security", "/settings/security"
                )
        );
    }
}
