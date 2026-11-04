package edu.augustana.csc305.project.controller;

import edu.augustana.csc305.project.dto.AdminDirectoryDtos;
import edu.augustana.csc305.project.service.AdminDirectoryService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/users")
public class AdminDirectoryController {
    private final AdminDirectoryService directory;
    public AdminDirectoryController(AdminDirectoryService directory) { this.directory = directory; }

    @GetMapping
    public ResponseEntity<AdminDirectoryDtos.Page> list(Authentication auth,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(directory.list(auth, search, page, size));
    }
}
