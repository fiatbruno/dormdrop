package edu.augustana.csc305.project;

import edu.augustana.csc305.project.controller.TeamRoleController;
import edu.augustana.csc305.project.model.UserRole;
import edu.augustana.csc305.project.service.TeamRoleService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TeamRoleControllerTest {
    @Test void parsesSupportedRolesAndRejectsUnsupportedValues() throws Exception {
        var roles = mock(TeamRoleService.class);
        when(roles.changeRole(any(), anyString(), eq(UserRole.MODERATOR))).thenReturn(UserRole.MODERATOR);
        var mvc = MockMvcBuilders.standaloneSetup(new TeamRoleController(roles)).build();
        mvc.perform(patch("/admin/team/123/role").contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"MODERATOR\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MODERATOR"));
        mvc.perform(patch("/admin/team/123/role").contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"SUPERUSER\"}"))
                .andExpect(status().isBadRequest());
    }
}
