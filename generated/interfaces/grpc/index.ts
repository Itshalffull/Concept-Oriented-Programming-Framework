// Auto-generated entrypoint for kit "conduit", target "grpc"
import { Server } from '@grpc/grpc-js';
import { ArticleService } from './Article/Article.service';
import { CommentService } from './Comment/Comment.service';
import { EchoService } from './Echo/Echo.service';
import { FavoriteService } from './Favorite/Favorite.service';
import { FollowService } from './Follow/Follow.service';
import { JWTService } from './JWT/JWT.service';
import { PasswordService } from './Password/Password.service';
import { ProfileService } from './Profile/Profile.service';
import { TagService } from './Tag/Tag.service';
import { UserService } from './User/User.service';

const server = new Server();

  server.addService(ArticleService);
  server.addService(CommentService);
  server.addService(EchoService);
  server.addService(FavoriteService);
  server.addService(FollowService);
  server.addService(JWTService);
  server.addService(PasswordService);
  server.addService(ProfileService);
  server.addService(TagService);
  server.addService(UserService);

export default server;
